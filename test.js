    if(state.next == "conditional"){
      let conditions;
      let currentState = chatFlow.states[state.next];
      let field = currentState.field;
      let fieldValue = redisClient.getUserData(chatId, field);


      if(currentState.condition && fieldValue){
         conditions = conditionals[currentState?.condition ?? "undefinedState"] || (async () => {
          await sendMessage("Algo inesperado aconteceu...", msg.from);
        });
      }else{
        await sendMessage("Campo não informado....", msg.from);
      }
      if(conditions && await conditions(fieldValue,currentState.param)){
        const action = stateActions[chatFlow.states[currentState.true].type ?? "undefinedState"] || (async () => {
          await sendMessage("Algo inesperado aconteceu.", chatId);
        });

        await action(currentState.true, chatId);
        await redisClient.setUser(chatId, {currentStateId: currentState.true});
      }else{
        const action = stateActions[chatFlow.states[currentState.false].type ?? "undefinedState"] || (async () => {
          await sendMessage("Algo inesperado aconteceu.", chatId);
        });
        await action(currentState.false, chatId);
        await redisClient.setUser(chatId, {currentStateId: currentState.false});
      }
    }