# Chatbot de WhatsApp com Fluxos Configuráveis

## Descrição
Este projeto implementa um chatbot de WhatsApp que utiliza a biblioteca `whatsapp-web.js` para automatizar a interação com usuários através de fluxos de conversa definidos em um arquivo JSON. O bot é capaz de responder com base em estados pré-definidos que podem ser facilmente modificados e ampliados conforme necessário.

## Pré-requisitos
Antes de iniciar, certifique-se de ter o Node.js instalado em seu ambiente. Além disso, você precisará do seguinte:
- NPM  para gerenciar as bibliotecas.
- WhatsApp no seu smartphone para escanear o QR code e conectar o bot.

## Instalação
1. **Clone o Repositório**
- `git clone https://github.com/joaoromaniello/poc-jsonChatbot.git` e `cd poc-jsonChatbot`

2. **Instalar Dependências**
- `npm install`

3. **Configuração**
- Adicione o arquivo `jsonTest.json` na pasta Fluxes. Este arquivo contém os estados do fluxo de conversa.

## Configuração do JSON de Fluxos
O arquivo `jsonTest.json` deve seguir esta estrutura básica:
```json
{
    "initialState": "welcome",
    "states": {
      "welcome": {
        "type":"baseMessage",
        "id": "welcome",
        "message": "Ola O que voce gostaria?",
        "options": [
          {
            "text": "Gostaria de ir para o fluxo A",
            "next": "fluxA"
          },
          {
            "text": "Gostaria de ir para o fluxo B",
            "next": "fluxB"
          }
        ],
        "dynamicOptions":{
        }
      },
      "fluxA": {
        "type":"baseMessage",
        "id": "fluxA",
        "message": "Ola... Voce esta no fluxo A;",
        "options": [
          {
            "text": "Finalizar",
            "next": "end"
          }
        ],
        "dynamicOptions":{

        }
      },
      "fluxB": {
        "type":"baseMessage",
        "id": "fluxB",
        "message": "Ola... Voce esta no fluxo B;",
        "options": [
          {
            "text": "Finalizar",
            "next": "end"
          }
        ],
        "dynamicOptions":{

        }
      },
      "end": {
        "type":"baseMessage",
        "id": "end",
        "message": "Obrigado por usar nosso chat. Tenha um ótimo dia!",
        "options": [],
        "dynamicOptions":{
          "field":"cnpj",
          "json":"apiUrl.com/cnpj",
          "template": "- CNPJ: {cnpj}",
          "isRecursive": true
        }
      }
    }
  }


```

## **Uso**
- Para iniciar o chatbot:
  `npm run start`
- Um QR Code será gerado no terminal. Use o WhatsApp em seu telefone para escanear o QR Code e estabelecer a conexão.
- O bot responderá automaticamente às mensagens recebidas conforme definido no arquivo JSON.
