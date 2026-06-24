import OpenAI from "openai";
import { searchProducts, checkItemsAvailability } from "../lib/product-search.js";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const STORE_NAME = process.env.STORE_NAME || "Eletro Líder Barretos";
const STORE_CITY = process.env.STORE_CITY || "Barretos/SP";
const STORE_ADDRESS =
  process.env.STORE_ADDRESS ||
  "Rua 16 nº 89, esquina da Avenida 29, Centro - Barretos/SP";
const STORE_WHATSAPP = process.env.STORE_WHATSAPP || "17 98804-9204";
const STORE_PHONE = process.env.STORE_PHONE || "17 3324-5600";
const RIO_PRETO_WHATSAPP = process.env.RIO_PRETO_WHATSAPP || "17 98816-0214";
const RIO_PRETO_LINK = process.env.RIO_PRETO_LINK || "https://wa.me/5517988160214";
const DELIVERY_MINIMUM_ORDER = process.env.DELIVERY_MINIMUM_ORDER || "50.00";
const DELIVERY_CITY = process.env.DELIVERY_CITY || "Barretos";
const DELIVERY_EXCLUDED_NEIGHBORHOOD =
  process.env.DELIVERY_EXCLUDED_NEIGHBORHOOD || "Vida Nova";
const HUMAN_HANDOFF_MESSAGE =
  process.env.HUMAN_HANDOFF_MESSAGE ||
  "Para eu não te passar uma informação errada, vou encaminhar sua mensagem para um atendente da Eletro Líder te confirmar certinho.";

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "intent", "handoff", "leadScore", "needsMoreItems", "leadData", "items"],
  properties: {
    reply: { type: "string" },
    intent: {
      type: "string",
      enum: [
        "saudacao",
        "pedido_orcamento",
        "consulta_preco",
        "consulta_estoque",
        "produto_especifico",
        "material_eletrico",
        "iluminacao",
        "eletricista_parceiro",
        "campanha_hora_do_chute",
        "duvida_tecnica",
        "endereco_horario",
        "reclamacao",
        "financeiro",
        "falar_com_atendente",
        "rio_preto",
        "outro"
      ]
    },
    handoff: { type: "boolean" },
    leadScore: {
      type: "string",
      enum: ["frio", "morno", "quente", "muito_quente"]
    },
    needsMoreItems: { type: "boolean" },
    leadData: {
      type: "object",
      additionalProperties: false,
      required: ["nome", "telefone", "produto", "quantidade", "cidade", "palpite", "primeiroGol"],
      properties: {
        nome: { type: "string" },
        telefone: { type: "string" },
        produto: { type: "string" },
        quantidade: { type: "string" },
        cidade: { type: "string" },
        palpite: { type: "string" },
        primeiroGol: { type: "string" }
      }
    },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["descricao", "quantidade", "trabalhamos", "observacao"],
        properties: {
          descricao: { type: "string" },
          quantidade: { type: "string" },
          trabalhamos: { type: "boolean" },
          observacao: { type: "string" }
        }
      }
    }
  }
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}

function sendJson(res, status, data) {
  return res.status(status).setHeader("Content-Type", "application/json").json(data);
}

function cleanText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function safeJsonParse(value, fallback = []) {
  try {
    if (!value) return fallback;
    if (Array.isArray(value) || typeof value === "object") return value;
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function extractLikelyItems(message) {
  const text = cleanText(message);
  if (!text) return [];

  const lines = text
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean);

  const items = [];

  for (const line of lines) {
    const quantityMatch = line.match(/(\d+[\.,]?\d*)\s*(m|mt|mts|metro|metros|un|und|unid|unidade|unidades|pc|pcs|peça|peças|rolo|rolos|barra|barras|caixa|cx)?/i);
    const quantity = quantityMatch ? quantityMatch[0] : "";
    const description = line.replace(/^[-•]\s*/, "").trim();

    if (description.length >= 3) {
      items.push({
        descricao: description,
        quantidade: quantity
      });
    }
  }

  return items.slice(0, 30);
}

function mergeItems(previousItems, newItems) {
  const all = [...(previousItems || []), ...(newItems || [])];
  const map = new Map();

  for (const item of all) {
    const key = cleanText(item.descricao || item.produto).toLowerCase();
    if (!key) continue;

    const existing = map.get(key);
    if (existing) {
      if (!existing.quantidade && item.quantidade) existing.quantidade = item.quantidade;
    } else {
      map.set(key, {
        descricao: cleanText(item.descricao || item.produto),
        quantidade: cleanText(item.quantidade),
        trabalhamos: Boolean(item.trabalhamos),
        observacao: cleanText(item.observacao)
      });
    }
  }

  return Array.from(map.values());
}

function enrichItemsWithProductList(items) {
  const checked = checkItemsAvailability(items);

  return items.map((item) => {
    const found = checked.find((c) => c.item === item.descricao);
    const trabalhamos = Boolean(found?.trabalhamos);

    return {
      descricao: item.descricao,
      quantidade: item.quantidade || "",
      trabalhamos,
      observacao: trabalhamos
        ? "Item encontrado na base de produtos. Não informar estoque nem preço."
        : "Item não encontrado na base de produtos. Confirmar com vendedor antes de responder com certeza."
    };
  });
}

function buildSystemPrompt(productMatches, currentItems) {
  return `
Você é um vendedor sênior da ${STORE_NAME}, unidade Barretos/SP.

DADOS OFICIAIS:
- Loja: ${STORE_NAME}
- Cidade: ${STORE_CITY}
- Endereço: ${STORE_ADDRESS}
- WhatsApp Barretos: ${STORE_WHATSAPP}
- Telefone fixo Barretos: ${STORE_PHONE}
- Vendedores Barretos: Victor, Paula, José Lucas e Felipe
- WhatsApp Rio Preto: ${RIO_PRETO_WHATSAPP}
- Link Rio Preto: ${RIO_PRETO_LINK}

PERSONALIDADE:
- Atendimento humanizado, cordial, consultivo e com postura de fechamento.
- Linguagem natural de WhatsApp.
- Não ser frio nem robótico.
- Não exagerar em emojis.
- Conduzir o cliente para enviar lista completa, quantidade e dados necessários.
- Não perder venda: sempre avance para o próximo passo.


REGRAS DE ENTREGA — ELETRO LÍDER BARRETOS:
- A Eletro Líder realiza entregas para compras a partir de R$ ${DELIVERY_MINIMUM_ORDER.replace(".", ",")}.
- Entregamos dentro da cidade de ${DELIVERY_CITY}/SP.
- Exceção: não realizamos entregas para o bairro ${DELIVERY_EXCLUDED_NEIGHBORHOOD}.
- Quando o cliente perguntar sobre entrega, pergunte o bairro se ele ainda não informou.
- Se o endereço for em Barretos e não for no bairro Vida Nova, responda:
  "Realizamos entregas em Barretos para compras a partir de R$ 50,00. Se desejar, informe seu endereço para que nossa equipe possa verificar os detalhes da entrega."
- Se o endereço for no bairro Vida Nova, responda:
  "No momento não realizamos entregas para o bairro Vida Nova. Você pode retirar seu pedido em nossa loja localizada na Rua 16 nº 89, esquina da Avenida 29, Centro - Barretos/SP."
- Nunca prometer prazo de entrega sem confirmação da equipe.
- Nunca informar taxa de entrega sem confirmação da equipe.
- Nunca informar disponibilidade de entrega para cidades fora de Barretos sem validação humana.
- Se houver dúvida sobre localidade ou logística, encaminhar para um vendedor.
- Quando solicitado, informe também o telefone fixo da loja: ${STORE_PHONE}.

REGRAS ABSOLUTAS:
1. Não informe preço.
2. Não informe estoque.
3. Não invente produto.
4. Não invente marca.
5. Não invente prazo.
6. Não invente promoção.
7. Não diga que tem disponível.
8. Não diga que não existe definitivamente; diga apenas que não encontrou na base e vai confirmar.
9. Só diga que trabalhamos com um item se ele aparecer na lista de produtos encontrada.
10. Se o item não aparecer na base, encaminhe para vendedor confirmar.
11. Sempre que captar itens, peça quantidade quando faltar.
12. Quando a lista estiver organizada, monte resumo e diga que vai passar para o vendedor dar continuidade.
13. Para risco elétrico, norma, instalação ou dimensionamento, responda com cautela e encaminhe para especialista.
14. Para Rio Preto, informe o link ${RIO_PRETO_LINK}.

BASE DE PRODUTOS:
Você receberá uma lista de possíveis produtos encontrados na base.
Use essa lista somente para dizer se trabalhamos com o item.
Não use a lista para preço, estoque ou prazo.

PRODUTOS ENCONTRADOS NA BASE:
${JSON.stringify(productMatches, null, 2)}

ITENS JÁ CAPTADOS NA CONVERSA:
${JSON.stringify(currentItems, null, 2)}

FORMATO:
Responda apenas em JSON válido conforme schema.
`;
}

function validateAiJson(data) {
  const fallbackLead = {
    nome: "",
    telefone: "",
    produto: "",
    quantidade: "",
    cidade: "",
    palpite: "",
    primeiroGol: ""
  };

  if (!data || typeof data !== "object") {
    throw new Error("Resposta da IA inválida.");
  }

  data.reply = cleanText(data.reply) || HUMAN_HANDOFF_MESSAGE;
  data.intent = cleanText(data.intent) || "outro";
  data.handoff = Boolean(data.handoff);
  data.leadScore = cleanText(data.leadScore) || "morno";
  data.needsMoreItems = Boolean(data.needsMoreItems);
  data.leadData = { ...fallbackLead, ...(data.leadData || {}) };
  data.items = Array.isArray(data.items) ? data.items : [];

  return data;
}

async function generateReply({ name, phone, message, previousItems, customFields }) {
  const likelyItems = extractLikelyItems(message);
  const mergedItems = mergeItems(previousItems, likelyItems);
  const enrichedItems = enrichItemsWithProductList(mergedItems);

  const productMatches = [];
  for (const item of likelyItems) {
    productMatches.push({
      consulta: item.descricao,
      encontrados: searchProducts(item.descricao, 8)
    });
  }

  const userPayload = {
    nome_recebido: name,
    telefone_recebido: phone,
    mensagem_cliente: message,
    itens_detectados_nesta_mensagem: likelyItems,
    itens_acumulados: enrichedItems,
    campos_personalizados: customFields || {}
  };

  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.25,
    messages: [
      {
        role: "system",
        content: buildSystemPrompt(productMatches, enrichedItems)
      },
      {
        role: "user",
        content: JSON.stringify(userPayload, null, 2)
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "eletro_lider_sales_response",
        strict: true,
        schema: responseSchema
      }
    }
  });

  const content = completion.choices?.[0]?.message?.content || "{}";
  const aiResult = validateAiJson(JSON.parse(content));

  const finalItems = enrichItemsWithProductList(mergeItems(enrichedItems, aiResult.items));
  aiResult.items = finalItems;

  if (!aiResult.leadData.nome && name) aiResult.leadData.nome = name;
  if (!aiResult.leadData.telefone && phone) aiResult.leadData.telefone = phone;

  return aiResult;
}

export default async function handler(req, res) {
  Object.entries(corsHeaders()).forEach(([key, value]) => res.setHeader(key, value));

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    return sendJson(res, 200, {
      ok: true,
      service: "manychat-openai-whatsapp-produtos",
      store: STORE_NAME,
      webhook: "/api/webhook"
    });
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, { ok: false, error: "Use POST." });
  }

  try {
    const body = req.body || {};

    const name = cleanText(body.name || body.first_name || body.nome);
    const phone = cleanText(body.phone || body.whatsapp || body.telefone);
    const message = cleanText(body.message || body.text || body.last_text_input || body.mensagem);
    const customFields = body.customFields || body.custom_fields || {};
    const previousItems = safeJsonParse(body.items || body.previousItems || body.itens, []);

    if (!message) {
      return sendJson(res, 200, {
        ok: false,
        reply: HUMAN_HANDOFF_MESSAGE,
        intent: "outro",
        handoff: true,
        leadScore: "morno",
        needsMoreItems: false,
        items: [],
        itemsJson: "[]",
        resumo: "",
        leadData: {
          nome: name,
          telefone: phone,
          produto: "",
          quantidade: "",
          cidade: "",
          palpite: "",
          primeiroGol: ""
        }
      });
    }

    const aiResult = await generateReply({
      name,
      phone,
      message,
      previousItems,
      customFields
    });

    const resumo = aiResult.items
      .map((item) => {
        const status = item.trabalhamos ? "trabalhamos" : "confirmar";
        return `• ${item.descricao}${item.quantidade ? ` — ${item.quantidade}` : ""} (${status})`;
      })
      .join("\n");

    return sendJson(res, 200, {
      ok: true,
      reply: aiResult.reply,
      intent: aiResult.intent,
      handoff: aiResult.handoff,
      leadScore: aiResult.leadScore,
      needsMoreItems: aiResult.needsMoreItems,
      leadData: aiResult.leadData,
      items: aiResult.items,
      itemsJson: JSON.stringify(aiResult.items),
      resumo,
      palpite: aiResult.leadData.palpite,
      primeiroGol: aiResult.leadData.primeiroGol,
      produto: aiResult.leadData.produto,
      quantidade: aiResult.leadData.quantidade,
      cidade: aiResult.leadData.cidade,
      contatos: {
        barretos: {
          whatsapp: STORE_WHATSAPP,
          fixo: STORE_PHONE,
          endereco: STORE_ADDRESS
        },
        rioPreto: {
          whatsapp: RIO_PRETO_WHATSAPP,
          link: RIO_PRETO_LINK
        }
      }
    });
  } catch (error) {
    console.error("Erro no webhook:", error);

    return sendJson(res, 200, {
      ok: false,
      reply: HUMAN_HANDOFF_MESSAGE,
      intent: "outro",
      handoff: true,
      leadScore: "morno",
      needsMoreItems: false,
      items: [],
      itemsJson: "[]",
      resumo: "",
      leadData: {
        nome: "",
        telefone: "",
        produto: "",
        quantidade: "",
        cidade: "",
        palpite: "",
        primeiroGol: ""
      },
      error: "Falha ao processar atendimento."
    });
  }
}
