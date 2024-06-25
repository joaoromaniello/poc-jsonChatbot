const QRCODE = require("qrcode-terminal");
const { Client } = require("whatsapp-web.js");
const chatFlow = require("../Fluxes/jsonComplexFlux.json");
const redis = require("redis");

const client = new Client();
const redisClient = redis.createClient({
  URL: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.connect();

redisClient.on("connect", () => console.log("Connected to Redis!"));

async function sendMessage(message, chatId) {
  await client.sendMessage(chatId, message);
}

async function showState(stateId, chatId) {
  console.log("Sending msg to user using: " + stateId + "\n");
  console.log("antes", await getUser(chatId));
  setUser(chatId, JSON.stringify({ currentStateId: stateId }));
  console.log("depois", await getUser(chatId));
  const state = chatFlow.states[stateId];
  let message;

  if (state.type == "baseMessage") {
    message = state.message + "\n";
    state.options.forEach((option, index) => {
      message += `\n*${index + 1}*. ${option.text}`;
    });
    console.log("Sending message: " + message + "\n");
    return sendMessage(message, chatId);
  } else if (state.type == "apiCall") {
    //Caso tiver template message...
    if (state.dynamicOptions.template) {
      return fetch(state.dynamicOptions.url)
        .then((response) => response.json())
        .then((data) => {
          const template = state.dynamicOptions.template;
          const filledTemplate = fillTemplateWithData(template, data);
          return sendMessage(filledTemplate, chatId);
        })
        .catch((error) => {
          console.error("Erro ao acessar a API:", error);
        });
    }

    return fetch(state.dynamicOptions.url)
      .then((response) => response.json())
      .then((data) => {
        console.log("Data: ", data);
        return;
      })
      .catch((error) => {
        console.error("Erro ao acessar a API:", error);
      });
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

async function setUser(id, value) {
  await redisClient.set(`user:${id}`, value);
}

async function getUser(id) {
  return JSON.parse(await redisClient.get(`user:${id}`));
}

client.on("message", async (msg) => {
  if (await getUser(msg.from) === null) {
    console.log("não encontrou")
    setUser(msg.from, JSON.stringify({ currentStateId: null }));
  }

  let user = await getUser(msg.from)
  console.log(user);

  let currentState = chatFlow.states[user.currentStateId];

  console.log(`Received message from ${msg.from}: ${msg.body}`);
  console.log(currentState);
  const message = msg.body.trim();
  const choiceIndex = parseInt(message, 10) - 1;

  if (!currentState || currentState === "end") {
    currentState = chatFlow.initialState;
    await showState(currentState, msg.from);
    return;
  }

  console.log(currentState)

  if (
    currentState.type == "baseMessage" &&
    choiceIndex >= 0 &&
    choiceIndex < currentState.options.length
  ) {
    console.log("entrou aqui")
    const nextStateId = currentState.options[choiceIndex].next;
    const nextState = chatFlow.states[nextStateId];
    await showState(nextStateId, msg.from);

    if (nextState.type == "apiCall") {
      await showState(nextState.options[0].next, msg.from);
    }
  } else if (
    currentState.type == "baseMessage" &&
    (choiceIndex < 0 || choiceIndex >= currentState.options.length)
  ) {
    await sendMessage("Opção inválida. Tente novamente.", msg.from);
    await showState(currentState, msg.from);
  }
});

client.initialize();
