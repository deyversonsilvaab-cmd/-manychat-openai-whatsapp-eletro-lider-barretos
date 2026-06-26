# Eletro Líder Enterprise V8.1 — Busca Forte

Esta versão corrige o problema onde a IA recebia:

`Oi, preciso de 10 metros de cabo 10mm e 2 disjuntores bipolar 40A`

e respondia que não encontrou no catálogo.

## Correções principais

- Extrai itens da frase do cliente antes de chamar a IA.
- Separa lista em itens:
  - CABO FLEXIVEL 10MM — 10 MT
  - DISJUNTOR BIPOLAR 40A — 2 PC
- Normaliza:
  - 10mm, 10 mm, 10MM2, 10 MM²
  - disj, disjuntor, 2p, bipolar, 2 x
- Busca aproximada com pontuação.
- Continua a venda mesmo quando algum item fica duvidoso.
- Retorna `status`, `routeSellerName` e `routeQueue` para o ManyChat.

## Arquivos principais para substituir

Substitua no GitHub:

```txt
api/webhook.js
api/health.js
lib/utils.js
lib/csv.js
lib/data-loader.js
lib/products.js
lib/items.js
lib/score.js
lib/fast.js
lib/cross-sell.js
prompts/system.txt
data/sinonimos.json
data/cross-sell.json
data/politicas.json
```

Você também pode substituir tudo pelo conteúdo do ZIP.

## ManyChat — Body

```json
{
  "source": "manychat",
  "channel": "whatsapp",
  "name": "{{first_name}}",
  "phone": "{{phone}}",
  "message": "{{last_text_input}}",
  "status": "{{cf_status_atendimento}}",
  "items": "{{cf_lista_itens_json}}",
  "summary": "{{cf_conversation_summary}}",
  "lastIntent": "{{cf_ai_intent}}"
}
```

## ManyChat — Mapeamento

```txt
reply -> cf_ai_reply
intent -> cf_ai_intent
handoff -> cf_ai_handoff
leadScore -> cf_ai_lead_score
needsMoreItems -> cf_ai_needs_more_items
itemsJson -> cf_lista_itens_json
resumo -> cf_resumo_itens
conversationSummary -> cf_conversation_summary
nextAction -> cf_next_action
status -> cf_status_atendimento
routeSellerId -> cf_route_seller_id
routeSellerName -> cf_route_seller_name
routeQueue -> cf_route_queue
```

## Depois de subir

1. Commit changes no GitHub.
2. Vercel > Deployments > Redeploy.
3. Abrir `/api/health`.
4. Conferir se aparece:
   - service: eletro-lider-enterprise-v8-1-busca-forte
   - productsLoaded perto de 5700
   - testExtraction com cabo e disjuntor
   - testSearch com resultados.
5. Testar no WhatsApp:

```txt
Oi, preciso de 10 metros de cabo 10mm e 2 disjuntores bipolar 40A
```

Resposta esperada:

```txt
Perfeito, entendi sua solicitação:

• CABO FLEXIVEL 10MM — 10 MT
• DISJUNTOR BIPOLAR 40A — 2 PC

Você prefere retirada na loja ou entrega em Barretos?
```
