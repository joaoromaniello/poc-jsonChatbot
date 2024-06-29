const redisClient = require("../src/redis/redisClient.js");

class Utility {
  static lastMessageSentTimes = {};

  static fillTemplateWithData(template, data) {
    return template.replace(/\{(\w+)\}/g, (match, key) => data[key] || match);
  }

  static async shouldIgnoreBasedOnTime(msg) {
    console.log(
      "Tempo das ultimas mensagens: ",
      Date.now() - Utility.lastMessageSentTimes[msg.from]
    );
    if (
      Utility.lastMessageSentTimes[msg.from] &&
      Date.now() - Utility.lastMessageSentTimes[msg.from] < 900
    ) {
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

  static async validaCNPJ(cnpj) {
    var b = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    var c = String(cnpj).replace(/[^\d]/g, "");

    if (c.length !== 14) return false;

    if (/0{14}/.test(c)) return false;

    for (var i = 0, n = 0; i < 12; n += c[i] * b[++i]);
    if (c[12] != ((n %= 11) < 2 ? 0 : 11 - n)) return false;

    for (var i = 0, n = 0; i <= 12; n += c[i] * b[i++]);
    if (c[13] != ((n %= 11) < 2 ? 0 : 11 - n)) return false;

    return true;
  }

  static async validaCPF(cpf) {
    var Soma;
    var Resto;
    Soma = 0;
    if (cpf == "00000000000") return false;

    for (let i = 1; i <= 9; i++)
      Soma = Soma + parseInt(cpf.substring(i - 1, i)) * (11 - i);
    Resto = (Soma * 10) % 11;

    if (Resto == 10 || Resto == 11) Resto = 0;
    if (Resto != parseInt(cpf.substring(9, 10))) return false;

    Soma = 0;
    for (let i = 1; i <= 10; i++)
      Soma = Soma + parseInt(cpf.substring(i - 1, i)) * (12 - i);
    Resto = (Soma * 10) % 11;

    if (Resto == 10 || Resto == 11) Resto = 0;
    if (Resto != parseInt(cpf.substring(10, 11))) return false;
    return true;
  }
}

module.exports = Utility;
