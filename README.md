# Eletro Líder Enterprise V6

Versão Enterprise com:
- Atendimento sem depender de gatilho pré-definido.
- Leitura de imagem, foto, print, manuscrito e PDF por URL.
- Memória de cliente por telefone.
- Carrinho inteligente.
- Busca de produtos com sinônimos e categorias.
- Cross-sell consultivo.
- Lead Score automático.
- Handoff automático para vendedor.
- Endpoint de saúde `/api/health`.

## Arquivos principais

```txt
api/webhook.js
api/health.js
lib/
data/
prompts/
memory/
admin/
docs/
examples/
```

## Configuração Vercel

Use as variáveis do `.env.example`.

Principais:

```env
OPENAI_API_KEY=sua_chave
OPENAI_MODEL=gpt-5.5
FALLBACK_OPENAI_MODEL=gpt-5.4-mini
VISION_MODEL=gpt-5.5
ENABLE_MEMORY=true
ENABLE_ATTACHMENT_READING=true
ENABLE_CROSS_SELL=true
```

## ManyChat Body

```json
{
  "name": "{{first_name}}",
  "phone": "{{phone}}",
  "message": "{{last_text_input}}",
  "items": "{{cf_lista_itens_json}}",
  "summary": "{{cf_conversation_summary}}",
  "lastIntent": "{{cf_ai_intent}}",
  "image_url": "{{last_input_image_url}}",
  "file_url": "{{last_input_file_url}}",
  "attachment_url": "{{last_input_attachment_url}}"
}
```

## Mapeamento

```txt
$.reply -> cf_ai_reply
$.intent -> cf_ai_intent
$.handoff -> cf_ai_handoff
$.leadScore -> cf_ai_lead_score
$.needsMoreItems -> cf_ai_needs_more_items
$.itemsJson -> cf_lista_itens_json
$.resumo -> cf_resumo_itens
$.conversationSummary -> cf_conversation_summary
$.nextAction -> cf_next_action
$.attachmentSummary -> cf_attachment_summary
$.attachmentConfidence -> cf_attachment_confidence
$.needsBetterImage -> cf_needs_better_image
$.crossSellSuggestions -> cf_cross_sell
```

## Mensagem ao cliente

```txt
{{cf_ai_reply}}
```

## Handoff

Se `cf_ai_handoff = true`:
- Tag `ATENDIMENTO_HUMANO`
- Tag `ORCAMENTO_ELETRO_LIDER`
- Notificar vendedor com resumo.

## Default Reply

Configure este fluxo como:
- Resposta Padrão / Default Reply
ou
- Gatilho "O usuário envia uma mensagem"

Assim qualquer mensagem sem gatilho também entra na IA.
