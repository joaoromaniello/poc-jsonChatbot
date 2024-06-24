# Chatbot de WhatsApp com Fluxos Configuráveis

## Descrição
Este projeto implementa um chatbot de WhatsApp que utiliza a biblioteca `whatsapp-web.js` para automatizar a interação com usuários através de fluxos de conversa definidos em um arquivo JSON. O bot é capaz de responder com base em estados pré-definidos que podem ser facilmente modificados e ampliados conforme necessário.

## Pré-requisitos
Antes de iniciar, certifique-se de ter o Node.js instalado em seu ambiente. Além disso, você precisará do seguinte:
- NPM ou Yarn para gerenciar as bibliotecas.
- WhatsApp no seu smartphone para escanear o QR code e conectar o bot.

## Instalação
1. **Clone o Repositório**
   
git clone <url_do_repositorio>
cd <nome_do_projeto>

2. **Instalar Dependências**
npm install


3. **Configuração**
- Adicione o arquivo `jsonTest.json` na raiz do projeto. Este arquivo contém os estados do fluxo de conversa.

## Configuração do JSON de Fluxos
O arquivo `jsonTest.json` deve seguir esta estrutura básica:
```json
{
"initialState": "start",
"states": {
 "start": {
   "message": "Olá, o que você gostaria?",
   "options": [
     {"text": "Ir para o fluxo A", "next": "fluxoA"},
     {"text": "Ir para o fluxo B", "next": "fluxoB"}
   ]
 },
 "fluxoA": {
   "message": "Você está no fluxo A.",
   "options": []
 },
 "fluxoB": {
   "message": "Você está no fluxo B.",
   "options": []
 },
 "end": {
   "message": "Obrigado por usar nosso serviço!",
   "options": []
 }
}
}

```

## **Uso**
-Para iniciar o chatbot:
  node app.js
-Um QR Code será gerado no terminal. Use o WhatsApp em seu telefone para escanear o QR Code e estabelecer a conexão.
-O bot responderá automaticamente às mensagens recebidas conforme definido no arquivo JSON.
