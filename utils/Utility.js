const redisClient = require("../src/redis/redisClient.js");

class Utility {
  static lastMessageSentTimes = {};

  static fillTemplateWithData(template, data) {
    return template.replace(/\{(\w+)\}/g, (match, key) => data[key] || match);
  }

  static async shouldIgnoreBasedOnTime(msg) {
    console.log("Tempo das ultimas mensagens: ",Date.now() - Utility.lastMessageSentTimes[msg.from]);
    if (Utility.lastMessageSentTimes[msg.from] && Date.now() - Utility.lastMessageSentTimes[msg.from] < 900) {
      console.log("Mensagem ignorada devido ao intervalo de tempo.");
      return true;
    }
    return false;
  }

  static updateLastMessageSentTime(userId, time) {
    this.lastMessageSentTimes[userId] = time;
  }

  static getLastMessageSentTime(userId) {
    return this.lastMessageSentTimes[userId] || null;
  }

  static async shouldIgnoreBasedOnLock(msg) {
    const isLocked = await redisClient.getUserData(msg.from, "lock");
    if (isLocked) {
      console.log(`Mensagem de ${msg.from} ignorada devido ao bloqueio.`);
      return true;
    }
    return false;
  }
}

module.exports = Utility;
