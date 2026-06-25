# Eletro Líder Enterprise GPT-5.5

Projeto completo para atendimento IA da Eletro Líder Barretos usando ManyChat, Vercel, OpenAI, catálogo, memória de conversa e regras comerciais.

## O que esta versão faz

- Usa modelo configurável, padrão `gpt-5.5`.
- Tem fallback para `gpt-5.4-mini`.
- Consulta `data/produtos.csv`.
- Usa sinônimos para melhorar busca de produtos.
- Não informa preço, estoque ou prazo.
- Capta lista de materiais e quantidades.
- Monta resumo para vendedor.
- Usa memória de conversa via campos do ManyChat.
- Identifica intenção, lead score e necessidade de atendimento humano.
- Inclui regras de entrega da Eletro Líder Barretos.
- Inclui dados de Barretos e Rio Preto.
- Separa políticas, vendedores, campanhas, FAQ e sazonalidade em arquivos JSON.

## Estrutura

```txt
api/webhook.js
lib/
data/
prompts/
docs/
scripts/
examples/
package.json
vercel.json
.env.example
```

## Variáveis na Vercel

Cadastre em `Settings > Environment Variables`:

```env
OPENAI_API_KEY=sua_chave
OPENAI_MODEL=gpt-5.5
FALLBACK_OPENAI_MODEL=gpt-5.4-mini
STORE_NAME=Eletro Líder Barretos
STORE_CITY=Barretos/SP
STORE_ADDRESS=Rua 16 nº 89, esquina da Avenida 29, Centro - Barretos/SP
STORE_WHATSAPP=17 98804-9204
STORE_PHONE=17 3324-5600
RIO_PRETO_WHATSAPP=17 98816-0214
RIO_PRETO_LINK=https://wa.me/5517988160214
DELIVERY_MINIMUM_ORDER=50.00
DELIVERY_CITY=Barretos
DELIVERY_EXCLUDED_NEIGHBORHOOD=Vida Nova
HUMAN_HANDOFF_MESSAGE=Para eu não te passar uma informação errada, vou encaminhar sua mensagem para um atendente da Eletro Líder te confirmar certinho.
MAX_PRODUCT_MATCHES=10
```

Se o nome `gpt-5.5` não estiver liberado no seu projeto da OpenAI, altere apenas `OPENAI_MODEL` para o nome disponível na sua conta.

## URL do webhook

```txt
https://SEU-PROJETO.vercel.app/api/webhook
```

## ManyChat External Request

Método: `POST`

Body:

```json
{
  "name": "{{first_name}}",
  "phone": "{{phone}}",
  "message": "{{last_text_input}}",
  "items": "{{cf_lista_itens_json}}",
  "summary": "{{cf_conversation_summary}}",
  "lastIntent": "{{cf_ai_intent}}"
}
```

## Mapeamento de respostas

```txt
$.reply               -> cf_ai_reply
$.intent              -> cf_ai_intent
$.handoff             -> cf_ai_handoff
$.leadScore           -> cf_ai_lead_score
$.needsMoreItems      -> cf_ai_needs_more_items
$.itemsJson           -> cf_lista_itens_json
$.resumo              -> cf_resumo_itens
$.conversationSummary -> cf_conversation_summary
$.nextAction          -> cf_next_action
```

Depois envie a mensagem:

```txt
{{cf_ai_reply}}
```

## Campos personalizados ManyChat

Crie como texto:

```txt
cf_ai_reply
cf_ai_intent
cf_ai_handoff
cf_ai_lead_score
cf_ai_needs_more_items
cf_lista_itens_json
cf_resumo_itens
cf_conversation_summary
cf_next_action
```

## Regras de entrega

- Entrega em Barretos para compras a partir de R$ 50,00.
- Não entrega no bairro Vida Nova.
- Não promete prazo.
- Não informa taxa sem confirmação.
- Telefone fixo: 17 3324-5600.

## Atualizar lista de produtos

Troque somente:

```txt
data/produtos.csv
```

Mantenha o mesmo nome.

## Melhorias futuras

- Banco de dados para memória real.
- Integração com ERP.
- Leitura de imagens/fotos de produtos.
- Painel administrativo.
