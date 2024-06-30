const rabbitMQManager = require("./rabbitManager");

class FlowService {
  constructor(exchangeName = "direct_exchange") {
    this.exchangeName = exchangeName;
    this.channel = null;
    this.userFlows = {};
  }

  async connect() {
    try {
      const connection = await rabbitMQManager.connect();
      this.channel = await connection.createChannel();
      await this.channel.assertExchange(this.exchangeName, "direct", {
        durable: false,
      });
    } catch (error) {
      console.error("Erro ao conectar e configurar RabbitMQ:", error);
      throw error;
    }
  }

  async startFlow(tenant, user, messageHandlerCallback) {
    try {
      if (this.userFlows.hasOwnProperty(user)) {
        return this.userFlows[user];
      }

      await this.connect();

      const queueName = `${tenant}_${user}_queue`;
      await this.channel.assertQueue(queueName, { durable: false });

      await this.channel.bindQueue(queueName, this.exchangeName, queueName);

      // Configurar consumidor para esta fila
      await this.setupConsumer(queueName, messageHandlerCallback);

      this.userFlows[user] = queueName;

      return queueName;
    } catch (error) {
      console.error("Erro ao iniciar o fluxo:", error);
      throw error;
    }
  }

  async publishMessage(tenant, user, message) {
    try {
      if (this.channel == null) {
        await this.connect();
      }

      const queueName = `${tenant}_${user}_queue`;
      this.channel.publish(
        this.exchangeName,
        queueName,
        Buffer.from(JSON.stringify(message))
      );

      console.log(
        `Mensagem enviada para a fila ${queueName}: ${JSON.stringify(message)}`
      );
    } catch (error) {
      console.error("Erro ao enviar mensagem para a fila:", error);
      throw error;
    }
  }

  async setupConsumer(queueName, messageHandlerCallback) {
    try {
      await this.channel.consume(
        queueName,
        async (message) => {
          if (message !== null) {
            try {
              const content = JSON.parse(message.content.toString());

              await messageHandlerCallback(content);
              this.channel.ack(message);
            } catch (error) {
              console.error("Erro ao processar mensagem:", error);
              this.channel.reject(message, false);
            }
          }
        },
        {
          consumerTag: queueName,
        }
      );

      console.log(`Consumidor configurado para a fila ${queueName}`);
    } catch (error) {
      console.error("Erro ao configurar consumidor:", error);
      throw error;
    }
  }

  async endFlow(tenant, user) {
    try {
      const queueName = this.userFlows[user];
      await this.channel.cancel(queueName);
      await this.channel.unbindQueue(queueName, this.exchangeName, queueName);
      await this.channel.deleteQueue(queueName);
      console.log(`Fluxo encerrado. Fila ${queueName} removida.`);
      delete this.userFlows[user];
    } catch (error) {
      console.error("Erro ao encerrar o fluxo:", error);
      throw error;
    }
  }

  async close() {
    try {
      if (this.channel) {
        await this.channel.close();
        console.log("Canal do RabbitMQ fechado.");
      }
    } catch (error) {
      console.error("Erro ao fechar o canal do RabbitMQ:", error);
      throw error;
    }
  }
}

module.exports = FlowService;
