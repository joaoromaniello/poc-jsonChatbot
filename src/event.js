const redisClient = require("./clients/redisClient");
const chatFlow = require("../Fluxes/jsonMain.json");

let client = null;

const stateHandlers = {
  sendMessage: async (state, user, message) =>
    await sendFlowMessage(state, user, message),
  iterationMenu: async (state, user, message) =>
    await iterationMenu(state, user, message),
  apiCall: async (state, user, message) => await apiCall(state, user, message),
  undefinedState: async (state, user, message) =>
    await undefinedState(state, user, message),
};

async function sendFlowMessage(state, user, message) {
  await sendMessage(user.phone, state.message);
  user.currentStateId = state.next;
  await redisClient.setUser(user.phone, user);
}

async function iterationMenu(state, user, message) {
  //   const option = state.options[parseInt(message.body) - 1];
  //   if (!option) {
  //     await sendMessage(user.phone, "Opção inválida! Tente novamente.");
  //     return;
  //   }
  //   await sendMessage(user.phone, option.text);
  //   await redisClient.setUser(user.phone, {
  //     currentStateId: option.nextState,
  //   });
}

async function apiCall(state, user, message) {}

async function undefinedState(state, user, message) {
  await sendMessage(user.phone, "Algo deu errado! Tente novamente.");
}

async function handleState(user, message) {
  const state = chatFlow.states[user.currentStateId] || {
    type: "undefinedState",
  };

  try {
    await stateHandlers[state.type](state, user, message);
  } catch (error) {
    console.error("Error handling state", error);
    await sendMessage(user.phone, "Algo deu errado! Tente novamente");
  } finally {
    if (!!state.end) {
      await redisClient.deleteUser(user.phone);
    }
  }
}

async function sendMessage(chatId, message) {
  console.log("Sending message to: ", chatId, " - Message: ", message);
  await client.sendMessage(chatId, message);
}

async function treatEvent(message, _client) {
  if (client === null) {
    client = _client;
  }

  let user = await redisClient.getUser(message.from);

  if (!user) {
    console.log(`User not found. Creating new user: ${message.from}`);
    user = {
      currentStateId: chatFlow.initialState,
      phone: message.from,
      params: {},
    };
    await redisClient.setUser(message.from, user);
  }

  console.log(
    `User: ${message.from} - Message: ${message.body} - Current state: ${user.currentStateId}`
  );

  await handleState(user, message);
}

module.exports = { treatEvent };
