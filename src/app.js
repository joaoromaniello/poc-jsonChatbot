const QRCODE = require('qrcode-terminal');
const { Client } = require('whatsapp-web.js');
const chatFlow = require('../Fluxes/jsonTest.json');

const client = new Client();

client.on('qr', (qr) => {
    QRCODE.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Client is ready!');
});

let currentStateId = null;  

async function sendMessage(message, chatId) {
    await client.sendMessage(chatId, message);
}

async function showState(stateId, chatId) {
    currentStateId = stateId;  
    const state = chatFlow.states[stateId];
    let message = state.message + "\n";
    state.options.forEach((option, index) => {
        message += `\n*${index + 1}*. ${option.text}`;
    });
    await sendMessage(message, chatId);
}

client.on('message', async msg => {
    if (!currentStateId || currentStateId === "end") {

        currentStateId = chatFlow.initialState;
        await showState(currentStateId, msg.from);
        return;
    }

    const currentState = chatFlow.states[currentStateId];
    const message = msg.body.trim();
    const choiceIndex = parseInt(message, 10) - 1;
    if (choiceIndex >= 0 && choiceIndex < currentState.options.length) {
        const nextStateId = currentState.options[choiceIndex].next;
        await showState(nextStateId, msg.from);
    } else {
        await sendMessage('Opção inválida. Tente novamente.', msg.from);
        await showState(currentStateId, msg.from); 
    }
});

client.initialize();
