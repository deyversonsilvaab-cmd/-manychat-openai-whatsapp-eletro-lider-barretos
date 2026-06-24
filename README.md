# Eletro Líder — ManyChat + OpenAI + Lista de Produtos

Versão 2 do webhook com consulta de lista de produtos.

## O que esta versão faz

1. Recebe mensagem do ManyChat.
2. Identifica itens e quantidades.
3. Consulta `data/produtos.csv`.
4. Informa somente se a loja trabalha ou não trabalha com o item encontrado na base.
5. Nunca informa preço.
6. Nunca informa estoque.
7. Nunca inventa produto.
8. Monta resumo da lista captada.
9. Encaminha para vendedor da loja de Barretos.
10. Informa endereço, WhatsApp e telefone fixo da unidade Barretos.
11. Encaminha para Rio Preto quando necessário.

## Dados oficiais configurados

Barretos:

- Endereço: Rua 16 nº 89, esquina da Avenida 29, Centro - Barretos/SP
- WhatsApp: 17 98804-9204
- Telefone fixo: 17 3324-5600
- Vendedores: Victor, Paula, José Lucas e Felipe

Rio Preto:

- WhatsApp: 17 98816-0214
- Link: https://wa.me/5517988160214

## Estrutura

```txt
api/webhook.js
lib/product-search.js
data/produtos.csv
scripts/check-list.js
scripts/normalize-list.js
package.json
vercel.json
.env.example
README.md
```

## Como trocar a lista de produtos no GitHub

Sempre que quiser atualizar a lista:

1. Abra o repositório no GitHub.
2. Entre na pasta `data`.
3. Clique no arquivo `produtos.csv`.
4. Clique no lápis ou em `Upload files`.
5. Substitua pelo novo arquivo CSV.
6. O nome precisa continuar exatamente:

```txt
produtos.csv
```

7. Clique em `Commit changes`.
8. A Vercel fará o redeploy automaticamente.

## Atenção

Não suba arquivo com outro nome, como:

```txt
LISTAGEM SIMPLIFICADA DE PRODUTOS completa.csv
```

O sistema espera este nome:

```txt
data/produtos.csv
```

## Variáveis da Vercel

Configure em Settings > Environment Variables:

```env
OPENAI_API_KEY=sua_chave_nova_da_openai
OPENAI_MODEL=gpt-4.1-mini
STORE_NAME=Eletro Líder Barretos
STORE_CITY=Barretos/SP
STORE_ADDRESS=Rua 16 nº 89, esquina da Avenida 29, Centro - Barretos/SP
STORE_WHATSAPP=17 98804-9204
STORE_PHONE=17 3324-5600
RIO_PRETO_WHATSAPP=17 98816-0214
RIO_PRETO_LINK=https://wa.me/5517988160214
HUMAN_HANDOFF_MESSAGE=Para eu não te passar uma informação errada, vou encaminhar sua mensagem para um atendente da Eletro Líder te confirmar certinho.
```

Nunca coloque sua chave real dentro do GitHub.

## Teste da API

Abra no navegador:

```txt
https://SEU-PROJETO.vercel.app/api/webhook
```

Deve retornar:

```json
{
  "ok": true,
  "service": "manychat-openai-whatsapp-produtos"
}
```

## Payload para ManyChat

Use Solicitação Externa / External Request:

Método:

```txt
POST
```

Body:

```json
{
  "name": "{{first_name}}",
  "phone": "{{phone}}",
  "message": "{{last_text_input}}",
  "items": "{{cf_lista_itens_json}}"
}
```

## Campos para salvar no ManyChat

Crie campos personalizados:

```txt
cf_ai_reply
cf_ai_intent
cf_ai_handoff
cf_ai_lead_score
cf_lista_itens_json
cf_resumo_itens
cf_ai_needs_more_items
```

Mapeamento:

```txt
$.reply          -> cf_ai_reply
$.intent         -> cf_ai_intent
$.handoff        -> cf_ai_handoff
$.leadScore      -> cf_ai_lead_score
$.needsMoreItems -> cf_ai_needs_more_items
$.itemsJson      -> cf_lista_itens_json
$.resumo         -> cf_resumo_itens
```

Depois responda o cliente com:

```txt
{{cf_ai_reply}}
```

## Condição para vendedor

Se:

```txt
cf_ai_handoff = true
```

Ação:

1. Adicionar tag `Atendimento Humano`.
2. Notificar equipe.
3. Enviar resumo:

```txt
Novo atendimento Eletro Líder Barretos

Nome: {{first_name}}
Telefone: {{phone}}
Intenção: {{cf_ai_intent}}
Lead: {{cf_ai_lead_score}}

Resumo:
{{cf_resumo_itens}}

Mensagem da IA:
{{cf_ai_reply}}
```

## Exemplo de cliente

Cliente:

```txt
Preciso de 100m cabo 10mm e 2 disjuntores bipolar 40a
```

Resposta esperada:

```txt
Perfeito, consegui organizar sua solicitação.

Encontrei esses itens na nossa base:
• Cabo 10mm — 100m
• Disjuntor bipolar 40A — 2 unidades

Vou encaminhar para um vendedor da Eletro Líder Barretos confirmar disponibilidade e dar continuidade ao atendimento.
```

## Melhorias incluídas

1. Consulta real na lista de produtos.
2. Captação acumulada da lista de itens.
3. Campo `itemsJson` para guardar a lista no ManyChat.
4. Resumo automático dos itens.
5. Lead score: frio, morno, quente ou muito quente.
6. Dados oficiais da loja Barretos.
7. Encaminhamento para Rio Preto.
8. Regras anti-invenção de preço, estoque e produto.


## Regras de entrega — Eletro Líder Barretos

A Eletro Líder realiza entregas para compras a partir de **R$ 50,00**.

Área de atendimento:

- Entregamos dentro da cidade de Barretos/SP.

Exceção:

- Não realizamos entregas para o bairro **Vida Nova**.

Quando o cliente perguntar sobre entrega:

- Se o cliente ainda não informou o bairro, a IA deve perguntar o bairro.
- Se for Barretos e não for Vida Nova, a IA informa que entregamos para compras a partir de R$ 50,00.
- Se for Vida Nova, a IA informa que não fazemos entrega no bairro e oferece retirada na loja.
- A IA nunca deve prometer prazo de entrega sem confirmação da equipe.
- A IA nunca deve informar taxa de entrega sem confirmação da equipe.
- Para cidades fora de Barretos, a IA deve encaminhar para vendedor confirmar.

Contato da loja Barretos:

- WhatsApp: 17 98804-9204
- Telefone fixo: 17 3324-5600

## Variáveis adicionais para entrega

```env
DELIVERY_MINIMUM_ORDER=50.00
DELIVERY_CITY=Barretos
DELIVERY_EXCLUDED_NEIGHBORHOOD=Vida Nova
```
