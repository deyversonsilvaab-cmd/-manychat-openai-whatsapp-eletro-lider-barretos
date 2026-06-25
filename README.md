# Eletro Líder Enterprise V5 Vision

Versão com leitura de imagem/PDF e atendimento sem depender de gatilho.

## Principais recursos
- Responde qualquer mensagem via Default Reply ou gatilho "usuário envia mensagem".
- Lê imagem, foto, print e manuscrito com URL de arquivo.
- Tenta interpretar PDF quando a URL for acessível. Se não conseguir, pede print/foto nítida.
- Transcreve orçamento e extrai itens e quantidades.
- Consulta `data/produtos.csv`.
- Nunca informa preço, estoque ou prazo.
- Carrinho inteligente com memória via ManyChat.
- Handoff automático para vendedor.

## Body ManyChat

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

Os campos de arquivo podem ter nomes diferentes no ManyChat. Se não aparecerem, selecione pelo botão de variáveis.

## Mapeamento de respostas
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

## Mensagem ao cliente
{{cf_ai_reply}}

## Handoff
Se cf_ai_handoff = true:
- Tag ATENDIMENTO_HUMANO
- Tag ORCAMENTO_ELETRO_LIDER
- Notificar vendedor com resumo e arquivo lido

## Sem gatilho
Configure o fluxo como Resposta Padrão / Default Reply ou "O usuário envia uma mensagem".
