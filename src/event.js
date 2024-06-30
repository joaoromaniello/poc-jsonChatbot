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
  end: async (state, user, event) => {
    return { end: true };
  },
  inputForm: async (state, user, event) => await inputForm(state, user, event),
  condition: async (state, user, event) => await condition(state, user, event),
};

async function sendFlowMessage(state, user, event) {
  await sendMessage(user.phone, parseMessage(state, user));
  return { next: state.next };
}

function parseMessage(state, user) {
  return state.message.replace(/{{(.*?)}}/g, (match, param) => {
    return user.params[param] || match;
  });
}

async function iterationMenu(state, user, event) {
  console.log("iteration menu", event);
  if (!!user.waitUserInput) {
    const choiceIndex = parseInt(event.body, 10) - 1;

    if (choiceIndex >= 0 && choiceIndex < state.options.length) {
      return { next: state.options[choiceIndex].next };
    } else {
      await sendMessage(user.phone, "Opção inválida! Tente novamente.");
      return {
        type: "wait_user_input",
      };
    }
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

async function apiCall(state, user, event) {
  const response = await fetch(state.dynamicOptions.url);
  const data = await response.json();

  if (!state.dynamicOptions.fields) {
    return { next: state.next };
  }

  state.dynamicOptions.fields.forEach((field) => {
    if (data[field] !== undefined) {
      user.params[field] = data[field];
    }
  });

  return { next: state.next, data };
}

async function condition(state, user, event) {
  const condition = state.condition.replace(
    /\{\{(\w+)\}\}/g,
    (_, key) => user.params[key]
  );

  let result;
  try {
    result = new Function(`return ${condition}`)();
  } catch (error) {
    console.error("Erro ao avaliar condição:", error);
    throw new Error("Erro ao avaliar condição");
  }

  const nextStateId = result ? state.true : state.false;
  return { next: nextStateId };
}

async function undefinedState(state, user, message) {
  await sendMessage(user.phone, "Algo deu errado! Tente novamente.");
}

async function inputForm(state, user, event) {
  if (!!user.waitUserInput) {
    user.params[state.field] = event.body;
    return { next: state.next };
  }

  await sendMessage(user.phone, parseMessage(state, user));
  return {
    type: "wait_user_input",
  };
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
  flowService.publishMessage(TENANT, message.from, {
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
      if (!!response.end) {
        await redisClient.deleteUser(user.phone);
        flowService.endFlow(TENANT, user.phone);
        return;
      }

      if (!!response.next) {
        user.currentStateId = response.next;
        flowService.publishMessage(TENANT, user.phone, {
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
