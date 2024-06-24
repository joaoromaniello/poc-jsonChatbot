const readline = require('readline');
const chatFlow = require('./jsonFlux.json'); 

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function showState(stateId) {
  const state = chatFlow.states[stateId];
  console.log(state.message);
  state.options.forEach((option, index) => {
    console.log(`${index + 1}. ${option.text}`);
  });
  if (state.options.length > 0) {
    rl.question('Escolha uma opção: ', (answer) => {
      const choiceIndex = parseInt(answer, 10) - 1;
      if (choiceIndex >= 0 && choiceIndex < state.options.length) {
        const nextStateId = state.options[choiceIndex].next;
        showState(nextStateId);
      } else {
        console.log('Opção inválida. Tente novamente.');
        showState(stateId);
      }
    });
  } else {
    rl.close(); 
  }
}

function startChat() {
  showState(chatFlow.initialState);
}

rl.on('close', () => {
  console.log('Chat encerrado. Até a próxima!');
});

startChat();