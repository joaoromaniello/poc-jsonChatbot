const redisClient = require("./clients/redisClient");
const chatFlow = require("../Fluxes/jsonMain.json");
const FlowService = require("./clients/rabbitClient");

let client = null;
const TENANT = "DEV";
const flowService = new FlowService();

const stateHandlers = {
  sendMessage: async (state, user, event) =>
    await sendFlowMessage(state, user, event),
  iterationMenu: async (state, user, event) =>
    await iterationMenu(state, user, event),
  apiCall: async (state, user, event) => await apiCall(state, user, event),
  undefinedState: async (state, user, event) =>
    await undefinedState(state, user, event),
};

async function sendFlowMessage(state, user, event) {
  // TODO replace fields in message
  await sendMessage(user.phone, state.message);
  // user.currentStateId = state.next;
  return { next: state.next };
}

async function iterationMenu(state, user, event) {
  if (event.type?.toLowerCase() === "wait_user_input") {
    // pega a escolha do usuário e seta no next
    const choiceIndex = parseInt(event.body, 10) - 1;
    console.log("escolheu", choiceIndex);

    
  }

  let message;
  if (state.options) {
    message =
      `${state.message}\n` +
      state.options
        .map((option, index) => `\n*${index + 1}*. ${option.text}`)
        .join("");
  } else {
    message = `${state.message}\n`;
  }

  await sendMessage(user.phone, message);
  return {
    type: "wait_user_input",
  };
}

async function apiCall(state, user, message) {}

async function undefinedState(state, user, message) {
  await sendMessage(user.phone, "Algo deu errado! Tente novamente.");
}

async function handleState(user, event) {
  return new Promise(async (resolve, reject) => {
    const state = chatFlow.states[user.currentStateId] || {
      type: "undefinedState",
    };

    try {
      const stateResponse = await stateHandlers[state.type](state, user, event);
      resolve(stateResponse);
    } catch (error) {
      reject(error);
    }
    // finally {
    // TODO será que vai funcionar assim?
    // if (!!state.end) {
    //   await redisClient.deleteUser(user.phone);
    // } else if (!!state.next && state.next.length > 0) {
    //   user.currentStateId = state.next[0];
    //   await redisClient.setUser(user.phone, user);
    // }
    // }
  });
}

async function sendMessage(chatId, message) {
  console.log("Sending message to: ", chatId, " - Message: ", message);
  await client.sendMessage(chatId, message);
}

async function receiveMessage(message, _client) {
  // TODO mudar essa forma de setar o client
  if (client === null) {
    client = _client;
  }

  await flowService.startFlow(TENANT, message.from, treatEvent);

  // TODO caso a fila apague sem o usuário apagar, vai dar erro - arrumar isso
  flowService.sendMessage(TENANT, message.from, {
    type: "user_send_message",
    from: message.from,
    body: message.body,
  });
}

async function treatEvent(event) {
  console.log("Event received: ", event);
  let user = await redisClient.getUser(event.from);

  if (!user) {
    console.log(`User not found. Creating new user: ${event.from}`);
    user = {
      currentStateId: chatFlow.initialState,
      phone: event.from,
      params: {},
    };
    await redisClient.setUser(event.from, user);
  }

  console.log(`User: ${event.from} - Current state: ${JSON.stringify(user)}`);

  handleState(user, event)
    .then(async (response) => {
      // TODO seto a informação que está esperando user input
      // TODO se tiver next eu já publico algo novo na fila

      if (!!response.next) {
        user.currentStateId = response.next;
        flowService.sendMessage(TENANT, user.phone, {
          from: user.phone,
          ...response,
        });
      }
      user.waitUserInput =
        (response.type?.toLowerCase() || "") === "wait_user_input";

      redisClient.setUser(user.phone, user);
    })
    .catch((error) => {
      console.error("Error handling state", error);
      sendMessage(user.phone, "Algo deu errado! Tente novamente");
    });
}

module.exports = { receiveMessage };
