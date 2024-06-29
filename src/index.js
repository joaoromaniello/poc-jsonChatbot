const QRCODE = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");
const express = require("express");
const { receiveMessage } = require("./event.js");
const app = express();
const PORT = 3000;

const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: "autenticationFolder",
  }),
});

client.on("qr", (qr) => {
  QRCODE.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("Client is ready!");
});

client.on("message", async (msg) => {
  receiveMessage(msg, client);
});

app.get("/", (req, res) => {
  res.send("POC FLOW!");
});

app.listen(PORT, () => {
  console.log(`Running server on port ${PORT}`);
});

client.initialize();