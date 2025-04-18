const client = require('./clients/whatsappClient.js');
const chatFlow = require("../Fluxes/jsonTest.json");
const redisClient = require('./clients/redisClient.js');
const {isValidStateType} = require('./data/data.js');
const Utility = require('../utils/Utility');

const stateActions = {
  iterationMenu: async (state, chatId) => {
    console.log("Iteration Menu init...")
    await sendBaseMessage(state, chatId);
  },
  apiCall: async (state, chatId) => {
    await fetchAndUpdateUserData (state, chatId);
  },
  inputForm: async (state, chatId) => {
      await sendBaseMessage(state, chatId);
  },

  conditional: async (state, chatId) => {
    console.log(`Entered state ${state} in ${chatId}`)

  },
  undefinedState: async (state, chatId) => {
    await redisClient.setUser(chatId, {currentStateId: "error"});
    await sendBaseMessage(chatFlow.states["error"], chatId);
  },

};

const validationSet = {
  cnpjValidation: async (message) => {
    return Utility.validaCNPJ(message)
  },
  cpfValidation: async (message) => {
    return Utility.validaCPF(message)
  },

  undefinedState: async (message) => {
    await redisClient.setUser(chatId, {currentStateId: "error"});
    await sendBaseMessage(chatFlow.states["error"], chatId);
  },

};

const conditionals = {
  equals: async (message,param) => {
    return param === message;
  },
  greaterThan: async (message,param) => {
    return param.greaterThan(message);
  },
  lessThan: async (message,param) => {
    return param.lessThan(message);
  },
  undefinedState: async (message) => {
    await redisClient.setUser(chatId, {currentStateId: "error"});
    await sendBaseMessage(chatFlow.states["error"], chatId);
  },
}

async function sendMessage(message, chatId) {
  await client.sendMessage(chatId, message);
  Utility.updateLastMessageSentTime(chatId, new Date());
}

async function sendBaseMessage(state, chatId) {
  let message;
  console.log("Im on State: ", state )
  if(state.options){
    message= `${state.message}\n` + state.options.map((option, index) => `\n*${index + 1}*. ${option.text}`).join('');
  }
  else{
    message = `${state.message}\n` ;
  }

  await sendMessage(message, chatId);
}

async function fetchAndUpdateUserData (state, chatId) {
  try {
    const response = await fetch(state.dynamicOptions.url);
    const data = await response.json();

    await redisClient.updateUserWithData(chatId, data);

    if (state.dynamicOptions.template) {
      const filledTemplate = Utility.fillTemplateWithData(
        state.dynamicOptions.template,
        data
      );
      await sendMessage(filledTemplate, chatId);
    } else {
      console.log("Data: ", data);
    }
  } catch (error) {
    console.error("Erro ao acessar a API:", error);
  }
}

async function handleStateAction(stateId, chatId) {
  await redisClient.updateUserDataField(chatId, "lock", true);
  try {
    await redisClient.setUser(chatId, {currentStateId: stateId});
    let state = chatFlow.states[stateId];
    console.log("StateId: ", stateId)

    let action = stateActions[state?.type ?? "undefinedState"] || (async () => {
      await sendMessage("Algo inesperado aconteceu.", chatId);
    });

    await action(state, chatId);

    while(state.type && (state.type == "apiCall" || state.type == "conditional")){
          if(state.type == "apiCall"){
            console.log("API CALL")
      
            const nextState = state.options[0].next ? state.options[0].next : "welcome";
            const actionType = chatFlow.states[nextState]?.type ?? "undefinedState";
            console.log("Choosen nextState: ", nextState)
            console.log("The next state by law is ", state.options[0].next)
      
            let action = stateActions[actionType] || (async () => {
                await sendMessage("Algo inesperado aconteceu.", chatId);
      
            });
        
            await action(chatFlow.states[nextState], chatId);
        
            await redisClient.setUser(chatId, {currentStateId: nextState});
            
            state = chatFlow.states[nextState];
    }else if(state.type == "conditional"){
            console.log("Conditional")
            if(state.condition){
              const condition = conditionals[state?.condition ?? "undefinedState"] || (async () => {
                await sendMessage("Algo inesperado aconteceu.", msg.from);
              });
              
              const userFetchedData = await redisClient.getUserData(chatId,state.field)
              console.log(userFetchedData,state.param)
              if(await condition(userFetchedData, state.param)){
                console.log("Condition match...")
                let action = stateActions[chatFlow.states[state.true]?.type?? "undefinedState" ] || (async () => {await sendMessage("Algo inesperado aconteceu.", chatId);});
                await action(chatFlow.states[state.true], chatId);
                await redisClient.setUser(chatId, {currentStateId: chatFlow.states[state.true].id});
                state = chatFlow.states[state.true];
                break;
              }else{
                console.log("Condition not match...")
                action = stateActions[chatFlow.states[state.false]?.type?? "undefinedState" ] 
                await action(chatFlow.states[state.false], chatId);
                await redisClient.setUser(chatId, {currentStateId: chatFlow.states[state.false].id}); 
                state = chatFlow.states[state.false];
              }
          }
    }

    }

    if(!state.type){
      action = stateActions[undefinedState]
      await action("", chatId);
    }

} finally {
    await redisClient.updateUserDataField(chatId, "lock", false);
  }
}

client.on("message", async (msg) => {

  if (await Utility.shouldIgnoreBasedOnTime(msg) || await Utility.shouldIgnoreBasedOnLock(msg)) {
    return; 
  }

  let user = await redisClient.getUser(msg.from);
  
  if (!user) {
    user = { currentStateId: null, params: {} };
    await redisClient.setUser(msg.from, user);
  }

  console.log(
    `Received message from ${msg.from}: ${msg.body} - Current state: ${user.currentStateId}`
  );

  let currentState = chatFlow.states[user.currentStateId];
  const message = msg.body.trim();
  const choiceIndex = parseInt(message, 10) - 1;

  if (!currentState) {
    await handleStateAction(chatFlow.initialState, msg.from);
    return;
  }

  switch (currentState?.type ?? "undefinedState") {
    
    case "iterationMenu":
      if (choiceIndex >= 0 && choiceIndex < currentState.options.length) {
        const nextStateId = currentState.options[choiceIndex].next;
        user.currentStateId = nextStateId;  
        await redisClient.setUser(msg.from, user);

        await handleStateAction(nextStateId, msg.from);
      } else {
        await sendMessage("Opção inválida. Tente novamente.", msg.from);
        await handleStateAction(user.currentStateId, msg.from);
      }
      break;
    
    case "inputForm":
      if(currentState.inputValidation){
        const validation = validationSet[currentState?.inputValidation ?? "undefinedState"] || (async () => {
          await sendMessage("Algo inesperado aconteceu.", msg.from);
        });
  
        if(await validation(message)){
          await redisClient.updateUserDataField(msg.from, currentState.field, message);
          await handleStateAction(currentState.next, msg.from);
          break;
        }
        
        await sendMessage(`${currentState.field.toUpperCase()} inválido.`, msg.from);
        await handleStateAction(currentState.id, msg.from);
        break;
      }else{
        await redisClient.updateUserDataField(msg.from, currentState.field, message);
        await handleStateAction(currentState.next, msg.from);
        }
        break;

    case "undefinedState":
      await handleStateAction("error", msg.from);
      break;
  
    default:
      await sendMessage("Houve um erro inesperado. Por favor, tente novamente.", msg.from);
      await handleStateAction(user.currentStateId, msg.from);
      break;
  }

  user = await redisClient.getUser(msg.from);  

  if (user.currentStateId === "end") {
    await redisClient.deleteUser(msg.from);
  }
});

client.initialize();
