const QRCODE = require("qrcode-terminal");
const { Client,LocalAuth } = require("whatsapp-web.js");
const chatFlow = require("../Fluxes/jsonTest.json");
const redis = require("redis");
const redisClient = require('./redis/redisClient.js');


const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: 'autenticationFolder'
  })
})

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

    await redisClient.updateUserWithData(chatId, data);

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
  await redisClient.setUser(chatId, {currentStateId: stateId} );
  const state = chatFlow.states[stateId];

  switch (state?.type ?? "undefinedState") {
    case "iterationMenu":
      await sendBaseMessage(state, chatId);
      break;
    case "apiCall":
      await processApiCall(state, chatId);
      break;
    case "undefinedState":
      await redisClient.setUser(chatId,  {currentStateId: "error"});
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

client.on("qr", (qr) => {
  QRCODE.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("Client is ready!");
});

client.on("message", async (msg) => {
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
    await showState(chatFlow.initialState, msg.from);
    return;
  }

  switch (currentState?.type ?? "undefinedState") {
    case "iterationMenu":
      if (choiceIndex >= 0 && choiceIndex < currentState.options.length) {
        const nextStateId = currentState.options[choiceIndex].next;
        user.currentStateId = nextStateId;  
        await redisClient.setUser(msg.from, user);

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

  user = await redisClient.getUser(msg.from);  

  if (user.currentStateId === "end") {
    await redisClient.deleteUser(msg.from);
  }
});

client.initialize();
