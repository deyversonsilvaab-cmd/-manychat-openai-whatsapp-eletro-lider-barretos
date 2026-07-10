import OpenAI from "openai";
import { cors, clean, safeJson, truth, norm } from "../lib/utils.js";
import { loadKnowledge } from "../lib/data-loader.js";
import { extractItems, mergeItems, customerLikelyFinished, needsDeliveryQuestion, customerWantsReset } from "../lib/items.js";
import { validateItems, searchProducts } from "../lib/products.js";
import { leadScore, routeSeller } from "../lib/score.js";
import { fastReply } from "../lib/fast.js";
import { crossSell } from "../lib/cross-sell.js";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MODEL = process.env.OPENAI_MODEL || "gpt-5.5";
const FALLBACK_MODEL = process.env.FALLBACK_OPENAI_MODEL || "gpt-5.4-mini";

const STORE_NAME = process.env.STORE_NAME || "Eletro Líder Barretos";
const STORE_ADDRESS = process.env.STORE_ADDRESS || "Rua 16 nº 89, esquina da Avenida 29, Centro - Barretos/SP";
const STORE_WHATSAPP = process.env.STORE_WHATSAPP || "17 98804-9204";
const STORE_PHONE = process.env.STORE_PHONE || "17 3324-5600";
const RIO_PRETO_LINK = process.env.RIO_PRETO_LINK || "https://wa.me/5517988160214";

function json(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json");
  return res.json(payload);
}

function firstName(name = "") {
  const n = clean(name);
  if (!n) return "";
  return n.split(" ")[0];
}

function resumoItems(items = []) {
  if (!items.length) return "";
  return items.map((item) => {
    const ok = item.trabalhamos ? "encontrado no catálogo" : "confirmar com vendedor";
    return `• ${item.descricao}${item.quantidade ? ` — ${item.quantidade}` : ""} (${ok})`;
  }).join("\n");
}

function commercialReplyDeterministic({ items = [], suggestions = [], name = "", isFollowUp = false, alreadyHandedOff = false, deliveryMentioned = false }) {
  const saud = firstName(name);

if (!items.length) {
  return `${saud ? `${saud}, pode` : "Pode"} me mandar os itens com as quantidades que eu já organizo tudo certinho para o vendedor da Eletro Líder te atender.`;
}

const linhas = items.map((item) => {
  const nome = item.melhorResultado || item.descricao;
  const qtd = item.quantidade ? ` — ${item.quantidade}` : "";
  return `• ${nome}${qtd}`;
}).join("\n");

const sugestoes = suggestions.length
  ? `\n\nTambém posso pedir para o vendedor conferir itens relacionados, como ${suggestions.slice(0, 3).join(", ")}.`
  : "";

if (alreadyHandedOff) {
  return `Perfeito, já está tudo anotado com o vendedor:\n\n${linhas}\n\nQuer acrescentar mais algum item, ou já posso deixar assim para o vendedor confirmar direitinho com você?${sugestoes}`;
}

if (isFollowUp) {
  return `Show, segue o que já tenho anotado aqui:\n\n${linhas}\n\nQuer adicionar mais algum item, ou já posso chamar o vendedor para fechar com você?${sugestoes}`;
}

const intro = saud ? `${saud}, entendi sua solicitação` : "Perfeito, entendi sua solicitação";
  const pergunta = deliveryMentioned
  ? "Já anotei sua preferência de entrega/retirada, vou repassar tudo certinho para o vendedor."
    : "Você prefere retirada na loja ou entrega em Barretos?";

return `${intro}:\n\n${linhas}\n\n${pergunta}${sugestoes}`;
}

function buildIntent(message, items) {
  const m = message.toLowerCase();
  if (items.length) return "pedido_orcamento";
  if (m.includes("preço") || m.includes("preco") || m.includes("valor")) return "consulta_preco";
  if (m.includes("entrega")) return "entrega";
  if (m.includes("atendente") || m.includes("vendedor")) return "falar_com_atendente";
  return "geral";
}

async function aiOnlyWhenNoItems({ body, knowledge }) {
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["reply", "needsMoreItems", "conversationSummary", "nextAction"],
    properties: {
      reply: { type: "string" },
      needsMoreItems: { type: "boolean" },
      conversationSummary: { type: "string" },
      nextAction: { type: "string" }
    }
      };

  const system = `${knowledge.systemPrompt}

  Loja: ${STORE_NAME}
  Endereço: ${STORE_ADDRESS}
  WhatsApp: ${STORE_WHATSAPP}
  Telefone: ${STORE_PHONE}

  Importante:
  - Use este modelo apenas quando não houver itens extraídos.
  - Não informe preço, estoque ou prazo.
  - Peça a necessidade do cliente de forma comercial, breve e humana.`;

try {
  const response = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.4,
    messages: [
{ role: "system", content: system },
      { role: "user", content: JSON.stringify(body, null, 2) }
      ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "reply_v82", strict: true, schema }
    }
  });

  return JSON.parse(response.choices?.[0]?.message?.content || "{}");
} catch (error) {
  console.error("AI principal falhou:", error?.message || error);

  try {
    const response = await client.chat.completions.create({
      model: FALLBACK_MODEL,
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(body, null, 2) }
        ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "reply_v82", strict: true, schema }
      }
    });

  return JSON.parse(response.choices?.[0]?.message?.content || "{}");
  } catch (fallbackError) {
    console.error("AI fallback falhou:", fallbackError?.message || fallbackError);
    return {};
  }
}
}

export default async function handler(req, res) {
  cors(res);

if (req.method === "OPTIONS") return res.status(200).end();

if (req.method === "GET") {
  return json(res, 200, {
    ok: true,
    service: "eletro-lider-enterprise-v8-2-humanizado",
    model: MODEL,
    webhook: "/api/webhook"
  });
}

if (req.method !== "POST") {
  return json(res, 405, { ok: false, error: "Use POST." });
}

try {
  const body = req.body || {};
  const message = clean(body.message || body.text || body.last_text_input || body.mensagem);
  const name = clean(body.name || body.first_name || body.nome);
  const phone = clean(body.phone || body.telefone || body.whatsapp);
  const previousStatus = clean(body.status);
  let previousItems = safeJson(body.items, []);
  const previousSummary = clean(body.summary || body.conversationSummary || "");

  if (!message) {
    return json(res, 200, {
      ok: true,
      reply: "Me envie sua mensagem ou lista de materiais que eu te ajudo.",
      intent: "sem_mensagem",
      handoff: false,
      leadScore: "frio",
      needsMoreItems: true,
      itemsJson: JSON.stringify(previousItems || []),
      resumo: "",
      conversationSummary: previousSummary,
      nextAction: "aguardar_mensagem",
      status: "ia_coletando",
      routeSellerId: "",
      routeSellerName: "",
      routeQueue: ""
    });
  }

  const resetRequested = customerWantsReset(message);
  if (resetRequested) {
    previousItems = [];
  }

  if (truth(process.env.ENABLE_FAST_REPLY ?? "true") && (!previousItems || !previousItems.length) && !resetRequested) {
    const fast = fastReply(message);
    if (fast) {
      return json(res, 200, {
        ok: true,
        reply: fast.reply,
        intent: fast.intent,
        handoff: false,
        leadScore: "frio",
        needsMoreItems: false,
        itemsJson: "[]",
        resumo: "",
        conversationSummary: `Cliente iniciou conversa. Intenção: ${fast.intent}.`,
        nextAction: "aguardar_necessidade",
        status: "ia_coletando",
        routeSellerId: "",
        routeSellerName: "",
        routeQueue: ""
      });
    }
  }

  if (resetRequested) {
    return json(res, 200, {
      ok: true,
      reply: `Sem problemas${firstName(name) ? `, ${firstName(name)}` : ""}! Vamos começar de novo. Me conta os itens que você precisa que eu já organizo tudinho.`,
      intent: "reset_pedido",
      handoff: false,
      leadScore: "frio",
      needsMoreItems: true,
      itemsJson: "[]",
      resumo: "",
      conversationSummary: "Cliente pediu para recomeçar o pedido.",
      nextAction: "aguardar_necessidade",
      status: "ia_coletando",
      routeSellerId: "",
      routeSellerName: "",
      routeQueue: ""
    });
  }

  const knowledge = loadKnowledge();
  const extracted = extractItems(message);
  const merged = mergeItems(previousItems, extracted);
  const validated = validateItems(merged);
  const score = leadScore({ message, items: validated });
  const route = routeSeller({ message, items: validated, score });
  const suggestions = crossSell(validated);
  const intent = buildIntent(message, validated);
  const finished = customerLikelyFinished(message);
  const deliveryMentioned = needsDeliveryQuestion(message);

  const previousDescs = new Set((previousItems || []).map((i) => norm(clean(i.descricao || i.produto || i.item || ""))));
  const newlyAdded = extracted.filter((i) => !previousDescs.has(norm(clean(i.descricao))));
  const isFollowUp = (previousItems || []).length > 0 && newlyAdded.length === 0;
  const alreadyHandedOff = previousStatus === "aguardando_vendedor";

  const hasItems = validated.length > 0;
  const hasCommercialIntent = ["pedido_orcamento", "consulta_preco"].includes(intent) || finished || hasItems;
  const handoff = Boolean(hasCommercialIntent && hasItems);
  const status = handoff ? "aguardando_vendedor" : "ia_coletando";
  const resumo = resumoItems(validated);

  let reply = "";
  let needsMoreItems = !validated.length;
  let ai = {};

  if (hasItems) {
    reply = commercialReplyDeterministic({ items: validated, suggestions, name, isFollowUp, alreadyHandedOff, deliveryMentioned });
    needsMoreItems = false;
  } else if (process.env.OPENAI_API_KEY) {
    ai = await aiOnlyWhenNoItems({
      body: { name, phone, message, previousSummary, extracted, validated, score, route },
      knowledge
    });
    reply = clean(ai.reply) || commercialReplyDeterministic({ items: validated, suggestions, name, isFollowUp, alreadyHandedOff, deliveryMentioned });
    needsMoreItems = typeof ai.needsMoreItems === "boolean" ? ai.needsMoreItems : true;
  } else {
    reply = commercialReplyDeterministic({ items: validated, suggestions, name, isFollowUp, alreadyHandedOff, deliveryMentioned });
  }

  return json(res, 200, {
    ok: true,
    reply,
    intent,
    handoff,
    leadScore: score,
    needsMoreItems,
    items: validated,
    itemsJson: JSON.stringify(validated),
    resumo,
    conversationSummary: clean(ai.conversationSummary) || `${name || "Cliente"} solicitou: ${message}. Itens identificados: ${validated.map(i => i.descricao).join(", ") || "nenhum"}.`,
    nextAction: clean(ai.nextAction) || (handoff ? "vendedor_confirmar_orcamento" : "coletar_mais_dados"),
    status,
    routeSellerId: handoff ? route.routeSellerId : "",
    routeSellerName: handoff ? route.routeSellerName : "",
    routeQueue: handoff ? route.routeQueue : "",
    crossSellSuggestions: suggestions,
    contatos: {
      barretos: { whatsapp: STORE_WHATSAPP, telefone: STORE_PHONE, endereco: STORE_ADDRESS },
      rioPreto: { link: RIO_PRETO_LINK }
    },
    debug: {
      version: "v8.2",
      extracted,
      topSearchCabo10mm: searchProducts("cabo 10mm", 3),
      topSearchDisj40a: searchProducts("disjuntor bipolar 40a", 3)
    }
  });
} catch (error) {
  console.error("webhook error", error);

  return json(res, 200, {
    ok: false,
    reply: "Recebi sua mensagem, mas tive uma instabilidade para processar. Vou encaminhar para um atendente da Eletro Líder te ajudar.",
    intent: "erro",
    handoff: true,
    leadScore: "morno",
    needsMoreItems: false,
    itemsJson: "[]",
    resumo: "",
    conversationSummary: "",
    nextAction: "encaminhar_humano",
    status: "aguardando_vendedor",
    routeSellerId: "",
    routeSellerName: "",
    routeQueue: "ERRO_IA"
  });
}
}
