const QRCODE = require("qrcode-terminal");
const { Client,LocalAuth } = require("whatsapp-web.js");
const chatFlow = require("../Fluxes/jsonTest.json");
const redis = require("redis");

const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: 'autenticationFolder'
  })
})

const redisClient = redis.createClient({
  URL: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.connect();

redisClient.on("connect", () => console.log("Connected to Redis!"));

async function sendMessage(message, chatId) {
  await client.sendMessage(chatId, message);
}

async function sendBaseMessage(state, chatId) {
  let message = state.message + "\n";
  state.options.forEach((option, index) => {
    message += `\n*${index + 1}*. ${option.text}`;
  });
  await sendMessage(message, chatId);
}

async function processApiCall(state, chatId) {
  try {
    const response = await fetch(state.dynamicOptions.url);
    const data = await response.json();

    await updateUserWithData(chatId, data);

    if (state.dynamicOptions.template) {
      const filledTemplate = fillTemplateWithData(
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


async function showState(stateId, chatId) {
  await setUser(chatId, {currentStateId: stateId} );
  const state = chatFlow.states[stateId];

  switch (state?.type ?? "undefinedState") {
    case "iterationMenu":
      await sendBaseMessage(state, chatId);
      break;
    case "apiCall":
      await processApiCall(state, chatId);
      break;
    case "undefinedState":
      await setUser(chatId,  {currentStateId: "error"});
      await sendBaseMessage(chatFlow.states["error"], chatId);
      break;
    default:
      await sendMessage("Algo inesperado aconteceu.", chatId);
      break;
  }
}

function fillTemplateWithData(template, data) {
  return template.replace(/\{(\w+)\}/g, (match, key) => data[key] || match);
}

async function setUser(id, userObject) {
  const userKey = `user:${id}`;
  let currentValue = await redisClient.get(userKey);
  
  if (!currentValue) {
    currentValue = {}; 
  } else {
    currentValue = JSON.parse(currentValue); 
  }


  Object.assign(currentValue, userObject);

  await redisClient.set(userKey, JSON.stringify(currentValue));
}

async function getUser(id) {
  const userData = await redisClient.get(`user:${id}`);
  return userData ? JSON.parse(userData) : null;
}

async function deleteUser(id) {
  await redisClient.del(`user:${id}`);
}

async function updateUserWithData(chatId, data) {
  const userKey = `user:${chatId}`;
  let user = await redisClient.get(userKey);
  user = user ? JSON.parse(user) : { params: {} };  


  Object.assign(user.params, data);

  await redisClient.set(userKey, JSON.stringify(user));
}

async function getUserData(id, paramName) {
  const userKey = `user:${id}`;
  let user = await redisClient.get(userKey);

  if (!user) {
    console.log("Usuário não encontrado.");
    return null;  
  }

  user = JSON.parse(user); 
  if (user.params && user.params.hasOwnProperty(paramName)) {
    return user.params[paramName];  
  } else {
    console.log(`Parâmetro '${paramName}' não encontrado para o usuário.`);
    return null;  
  }
}


client.on("qr", (qr) => {
  QRCODE.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("Client is ready!");
});

client.on("message", async (msg) => {
  let user = await getUser(msg.from);

  if (!user) {
    user = { currentStateId: null, params: {} };
    await setUser(msg.from, user);
  }

  console.log(
    `Received message from ${msg.from}: ${msg.body} - Current state: ${user.currentStateId}`
  );

  let currentState = chatFlow.states[user.currentStateId];
  const message = msg.body.trim();
  const choiceIndex = parseInt(message, 10) - 1;

  if (!currentState) {
    await showState(chatFlow.initialState, msg.from);
    return;
  }

  switch (currentState?.type ?? "undefinedState") {
    case "iterationMenu":
      if (choiceIndex >= 0 && choiceIndex < currentState.options.length) {
        const nextStateId = currentState.options[choiceIndex].next;
        user.currentStateId = nextStateId;  
        await setUser(msg.from, user);

        await showState(nextStateId, msg.from);
        if (chatFlow.states[nextStateId]  && chatFlow.states[nextStateId].type == "apiCall") {
          await showState(chatFlow.states[nextStateId].options[0].next, msg.from);
        }
      } else {
        await sendMessage("Opção inválida. Tente novamente.", msg.from);
        await showState(user.currentStateId, msg.from);
      }
      break;

    case "undefinedState":
      await showState("error", msg.from);
      break;

    default:
      await sendMessage("Houve um erro inesperado. Por favor, tente novamente.", msg.from);
      await showState(user.currentStateId, msg.from);
      break;
  }

  user = await getUser(msg.from);  

  if (user.currentStateId === "end") {
    await deleteUser(msg.from);
  }
});

client.initialize();
