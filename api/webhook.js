import OpenAI from "openai";
import { cors, clean, safeJson, truth } from "../lib/utils.js";
import { loadKnowledge } from "../lib/data-loader.js";
import { extractItems, mergeItems, customerLikelyFinished } from "../lib/items.js";
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

function resumoItems(items = []) {
  if (!items.length) return "";
  return items.map((item) => {
    const ok = item.trabalhamos ? "encontrado no catálogo" : "confirmar com vendedor";
    return `• ${item.descricao}${item.quantidade ? ` — ${item.quantidade}` : ""} (${ok})`;
  }).join("\n");
}

function fallbackCommercialReply({ items, message, lead }) {
  if (items.length) {
    const linhas = items.map((item) => `• ${item.descricao}${item.quantidade ? ` — ${item.quantidade}` : ""}`).join("\n");
    return `Perfeito, entendi sua solicitação:\n\n${linhas}\n\nVocê prefere retirada na loja ou entrega em Barretos?`;
  }

  return "Perfeito. Me envie os itens com as quantidades que eu organizo para o vendedor da Eletro Líder te atender certinho.";
}

function buildIntent(message, items) {
  const m = message.toLowerCase();
  if (items.length) return "pedido_orcamento";
  if (m.includes("preço") || m.includes("preco") || m.includes("valor")) return "consulta_preco";
  if (m.includes("entrega")) return "entrega";
  if (m.includes("atendente") || m.includes("vendedor")) return "falar_com_atendente";
  return "geral";
}

async function aiRefineReply({ body, items, validated, score, route, suggestions, knowledge }) {
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

DADOS:
Loja: ${STORE_NAME}
Endereço: ${STORE_ADDRESS}
WhatsApp: ${STORE_WHATSAPP}
Telefone: ${STORE_PHONE}

Itens extraídos e validados:
${JSON.stringify(validated, null, 2)}

Complementos possíveis:
${JSON.stringify(suggestions, null, 2)}

Instrução:
- Se há itens validados, confirme a lista.
- Não diga que não encontrou tudo se há pelo menos um match.
- Nunca informe preço, estoque ou prazo.
- Pergunte retirada ou entrega em Barretos quando fizer sentido.
- Seja breve e vendedor.`;

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(body, null, 2) }
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "reply_v81", strict: true, schema }
      }
    });

    return JSON.parse(response.choices?.[0]?.message?.content || "{}");
  } catch (error) {
    console.error("AI principal falhou:", error?.message || error);

    try {
      const response = await client.chat.completions.create({
        model: FALLBACK_MODEL,
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(body, null, 2) }
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "reply_v81", strict: true, schema }
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
      service: "eletro-lider-enterprise-v8-1-busca-forte",
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
    const previousItems = safeJson(body.items, []);
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

    if (truth(process.env.ENABLE_FAST_REPLY ?? "true") && (!previousItems || !previousItems.length)) {
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

    const knowledge = loadKnowledge();
    const extracted = extractItems(message);
    const merged = mergeItems(previousItems, extracted);
    const validated = validateItems(merged);
    const score = leadScore({ message, items: validated });
    const route = routeSeller({ message, items: validated, score });
    const suggestions = crossSell(validated);
    const intent = buildIntent(message, validated);
    const finished = customerLikelyFinished(message);

    let ai = {};
    if (process.env.OPENAI_API_KEY) {
      ai = await aiRefineReply({
        body: { name, phone, message, previousSummary, extracted, validated, score, route },
        items: extracted,
        validated,
        score,
        route,
        suggestions,
        knowledge
      });
    }

    const reply = clean(ai.reply) || fallbackCommercialReply({ items: validated, message, lead: score });
    const needsMoreItems = typeof ai.needsMoreItems === "boolean" ? ai.needsMoreItems : !validated.length;
    const resumo = resumoItems(validated);

    // Handoff policy:
    // If there are validated items and the customer is asking for a quote/purchase, release seller.
    // Keep as IA if it is only greeting or vague question.
    const hasItems = validated.length > 0;
    const hasCommercialIntent = ["pedido_orcamento", "consulta_preco"].includes(intent) || finished || hasItems;
    const handoff = Boolean(hasCommercialIntent && hasItems);
    const status = handoff ? "aguardando_vendedor" : "ia_coletando";

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
