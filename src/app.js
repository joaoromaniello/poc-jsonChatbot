const QRCODE = require("qrcode-terminal");
const { Client } = require("whatsapp-web.js");
const chatFlow = require("../Fluxes/jsonComplexFlux.json");
const redis = require('redis');

const client = new Client();
const redisClient = redis.createClient({
  URL: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.connect();

redisClient.on('connect', () => console.log('Connected to Redis!'));

async function sendMessage(message, chatId) {
  await client.sendMessage(chatId, message);
}

function showState(stateId, chatId) {
  console.log("Sending msg to user using: " + stateId + "\n");
  currentStateId = stateId;
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
    if(state.dynamicOptions.template){
      return fetch(state.dynamicOptions.url)
      .then(response => response.json())
      .then(data => {
        const template = state.dynamicOptions.template;
        const filledTemplate = fillTemplateWithData(template, data);
        return sendMessage(filledTemplate, chatId); 
      })
      .catch(error => {
        console.error('Erro ao acessar a API:', error);
      });
    }

    return fetch(state.dynamicOptions.url)
    .then(response => response.json())
    .then(data => {
      console.log("Data: ", data);
      return;
    })
    .catch(error => {
      console.error('Erro ao acessar a API:', error);
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

function createUser(id) {
  redisClient.set(id, JSON.stringify({ currentStateId: null }));
  // redisClient.set(id, JSON.stringify({ currentStateId: chatFlow.initialState }));
}

function getUser(id) {
  return new Promise((resolve, reject) => {
    redisClient.get(id, (err, reply) => {
      if (err) {
        reject(err);
      } else if (reply === null) {
        // Se a chave não existir, reply será null
        createUser(id);
        // Após criar o usuário, busca novamente para garantir que agora existe
        redisClient.get(id, (err, newUserReply) => {
          if (err) {
            reject(err);
          } else {
            resolve(JSON.parse(newUserReply));
          }
        });
      } else {
        // Se a chave existir, processa a resposta
        resolve(JSON.parse(reply));
      }
    });
  });
}

client.on("message", async (msg) => {

  const currentState = getUser(msg.from).currentStateId;
  console.log(`Received message from ${msg.from}: ${msg.body}`);
  console.log(currentState);
  const message = msg.body.trim();
  const choiceIndex = parseInt(message, 10) - 1;


  if (!currentState || currentState === "end") {
    currentState = chatFlow.initialState;
    await showState(currentState, msg.from);
    return;
  }

  if (currentState.type == "baseMessage" && choiceIndex >= 0 && choiceIndex < currentState.options.length) {
    const nextStateId = currentState.options[choiceIndex].next;
    const nextState = chatFlow.states[nextStateId];
    await showState(nextStateId, msg.from);  
  
    if (nextState.type == "apiCall") {
      await showState(nextState.options[0].next, msg.from);  
    }
  } else if (currentState.type == "baseMessage" && (choiceIndex < 0 || choiceIndex >= currentState.options.length)) {
    await sendMessage("Opção inválida. Tente novamente.", msg.from);
    await showState(currentState, msg.from);
  }
});

client.initialize();
