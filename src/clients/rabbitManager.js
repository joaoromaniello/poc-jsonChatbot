const amqp = require("amqplib");

class RabbitMQManager {
  constructor(rabbitUrl = "amqp://localhost") {
    this.rabbitUrl = rabbitUrl;
    this.connection = null;
  }

  async connect() {
    try {
      if (!this.connection) {
        this.connection = await amqp.connect(this.rabbitUrl);
        console.log("Conexão estabelecida com RabbitMQ");
      }
      return this.connection;
    } catch (error) {
      console.error("Erro ao conectar ao RabbitMQ:", error);
      throw error;
    }
  }

  async close() {
    try {
      if (this.connection) {
        await this.connection.close();
        console.log("Conexão com RabbitMQ fechada.");
        this.connection = null;
      }
    } catch (error) {
      console.error("Erro ao fechar a conexão com RabbitMQ:", error);
      throw error;
    }
  }
}

const rabbitMQManager = new RabbitMQManager();

module.exports = rabbitMQManager;
