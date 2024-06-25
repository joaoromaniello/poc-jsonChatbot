const QRCODE = require("qrcode-terminal");
const { Client } = require("whatsapp-web.js");
const chatFlow = require("../Fluxes/jsonTest.json");
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
  await setUser(chatId, JSON.stringify({ currentStateId: stateId }));
  const state = chatFlow.states[stateId];

  switch (state?.type ?? "undefinedState") {
    case "iterationMenu":
      await sendBaseMessage(state, chatId);
      break;
    case "apiCall":
      await processApiCall(state, chatId);
      break;
    case "undefinedState":
      await setUser(chatId, JSON.stringify({ currentStateId: "error" }));
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

async function setUser(id, value) {
  await redisClient.set(`user:${id}`, value);
}

async function getUser(id) {
  return JSON.parse(await redisClient.get(`user:${id}`));
}

async function deleteUser(id) {
  await redisClient.del(`user:${id}`);
}

client.on("qr", (qr) => {
  QRCODE.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("Client is ready!");
});

client.on("message", async (msg) => {
  if ((await getUser(msg.from)) === null) {
    setUser(msg.from, JSON.stringify({ currentStateId: null, params: {} }));
  }

  let user = await getUser(msg.from);
  let currentState = chatFlow.states[user.currentStateId];

  console.log(
    `Received message from ${msg.from}: ${msg.body} - Current state: ${user.currentStateId}`
  );
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
        const nextState = chatFlow.states[nextStateId];
        await showState(nextStateId, msg.from);
  
        if (nextState.type == "apiCall") {
          await showState(nextState.options[0].next, msg.from);
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
    return;
  }
});


client.initialize();
