# ManyChat + OpenAI + Vercel — Eletro Líder Barretos

Projeto MVP para atendimento automático da Eletro Líder Barretos via ManyChat/WhatsApp, usando OpenAI e Vercel.

## Estrutura

```txt
manychat-openai-whatsapp
├── api
│   └── webhook.js
├── package.json
├── vercel.json
├── .env.example
└── README.md
```

## 1. Criar repositório no GitHub

1. Acesse o GitHub.
2. Clique em **+**.
3. Clique em **New repository**.
4. Nome sugerido:

```txt
manychat-openai-whatsapp
```

5. Marque como **Private**.
6. Clique em **Create repository**.

## 2. Subir os arquivos

Você pode subir pelo navegador:

1. Entre no repositório.
2. Clique em **Add file**.
3. Clique em **Upload files**.
4. Envie todos os arquivos do projeto.
5. Clique em **Commit changes**.

Ou pelo terminal:

```bash
git clone https://github.com/SEU_USUARIO/manychat-openai-whatsapp.git
cd manychat-openai-whatsapp
# copie os arquivos para esta pasta
git add .
git commit -m "Projeto inicial ManyChat OpenAI"
git push
```

## 3. Conectar na Vercel

1. Acesse a Vercel.
2. Clique em **Add New Project**.
3. Escolha o repositório `manychat-openai-whatsapp`.
4. Clique em **Import**.
5. Mantenha as configurações padrão.
6. Antes de publicar, configure as variáveis de ambiente.

## 4. Configurar variáveis de ambiente na Vercel

Em **Settings > Environment Variables**, adicione:

```env
OPENAI_API_KEY=sua_chave_da_openai
OPENAI_MODEL=gpt-4.1-mini
STORE_NAME=Eletro Líder Barretos
STORE_CITY=Barretos/SP
HUMAN_HANDOFF_MESSAGE=Para eu não te passar uma informação errada, vou encaminhar sua mensagem para um atendente da Eletro Líder te confirmar certinho.
```

Depois clique em **Deploy**.

## 5. URL do webhook

Depois do deploy, a Vercel vai gerar uma URL parecida com:

```txt
https://manychat-openai-whatsapp.vercel.app
```

A URL do webhook será:

```txt
https://manychat-openai-whatsapp.vercel.app/api/webhook
```

Teste abrindo no navegador. Deve aparecer:

```json
{
  "ok": true,
  "service": "manychat-openai-whatsapp"
}
```

## 6. Configurar no ManyChat

No ManyChat:

1. Vá em **Automação**.
2. Crie uma automação.
3. Adicione um gatilho de palavra-chave, por exemplo:
   - `palpite`
   - `orçamento`
   - `preço`
   - `estoque`
   - `atendente`
4. Depois adicione a ação:
   - **External Request**
   - ou **Solicitação Externa**

## 7. Configuração da solicitação externa

Método:

```txt
POST
```

URL:

```txt
https://SEU-PROJETO.vercel.app/api/webhook
```

Headers:

```txt
Content-Type: application/json
```

Body JSON:

```json
{
  "name": "{{first_name}}",
  "phone": "{{phone}}",
  "message": "{{last_text_input}}"
}
```

Caso o ManyChat use outro campo para a última mensagem, substitua `{{last_text_input}}` pelo campo correto disponível no seu painel.

## 8. Como salvar o retorno no ManyChat

A API retorna:

```json
{
  "ok": true,
  "reply": "mensagem para o cliente",
  "intent": "pedido_orcamento",
  "handoff": true,
  "leadData": {
    "nome": "João",
    "telefone": "17999999999",
    "produto": "cabo 10mm",
    "quantidade": "100 metros",
    "cidade": "Barretos",
    "palpite": "",
    "primeiroGol": ""
  },
  "palpite": "",
  "primeiroGol": "",
  "produto": "cabo 10mm",
  "quantidade": "100 metros",
  "cidade": "Barretos"
}
```

Crie campos personalizados no ManyChat:

```txt
ai_reply
ai_intent
ai_handoff
ai_palpite
ai_primeiro_gol
ai_produto
ai_quantidade
ai_cidade
```

Mapeie:

```txt
$.reply          -> ai_reply
$.intent         -> ai_intent
$.handoff        -> ai_handoff
$.palpite        -> ai_palpite
$.primeiroGol    -> ai_primeiro_gol
$.produto        -> ai_produto
$.quantidade     -> ai_quantidade
$.cidade         -> ai_cidade
```

## 9. Responder o cliente

Depois da solicitação externa, adicione uma mensagem de WhatsApp com:

```txt
{{ai_reply}}
```

## 10. Encaminhar para atendente humano

Crie uma condição:

```txt
Se ai_handoff = true
```

Então:

1. Notifique a equipe.
2. Adicione tag:
   - `Atendimento Humano`
3. Pare o fluxo automático ou encaminhe para o setor responsável.

Mensagem interna sugerida:

```txt
Novo atendimento para humano.

Nome: {{first_name}}
Telefone: {{phone}}
Intenção: {{ai_intent}}
Produto: {{ai_produto}}
Quantidade: {{ai_quantidade}}
Cidade: {{ai_cidade}}
Mensagem IA: {{ai_reply}}
```

Se `ai_handoff = false`, continue o fluxo automático normalmente.

## 11. Teste com exemplos reais

### Saudação

Payload:

```json
{
  "name": "Carlos",
  "phone": "17999999999",
  "message": "Oi, bom dia"
}
```

Resposta esperada:

```json
{
  "reply": "Bom dia, Carlos! Tudo bem? Como posso te ajudar hoje na Eletro Líder?",
  "intent": "saudacao",
  "handoff": false
}
```

### Pedido de preço

Payload:

```json
{
  "name": "Marcos",
  "phone": "17999999999",
  "message": "Quanto está o cabo 10mm?"
}
```

Resposta esperada:

```json
{
  "reply": "Consigo te ajudar sim. Para eu te passar certinho para a equipe confirmar, você precisa de quantos metros de cabo 10mm?",
  "intent": "consulta_preco",
  "handoff": true
}
```

### Hora do Chute

Payload:

```json
{
  "name": "Pedro",
  "phone": "17999999999",
  "message": "Brasil 2x0, primeiro gol 22 minutos"
}
```

Resposta esperada:

```json
{
  "reply": "✅ Palpite registrado! Placar: Brasil 2x0. Primeiro gol: 22 minutos. Boa sorte na Copa dos Eletricistas da Eletro Líder!",
  "intent": "campanha_hora_do_chute",
  "handoff": false
}
```

## 12. Como editar o prompt do atendente

Abra o arquivo:

```txt
api/webhook.js
```

Procure pela função:

```js
function buildSystemPrompt()
```

Edite as regras dentro dela.

## 13. Melhorias futuras

Esta versão não usa banco de dados e não usa Google Sheets.

Melhorias possíveis:

1. Salvar leads em Google Sheets.
2. Criar histórico por telefone.
3. Criar setores: orçamento, eletricistas, financeiro e reclamações.
4. Criar dashboard de leads.
5. Integrar catálogo real de produtos.
6. Integrar estoque real do sistema da loja.
