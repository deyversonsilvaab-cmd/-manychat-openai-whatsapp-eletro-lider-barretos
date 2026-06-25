import OpenAI from "openai";
import { corsHeaders, cleanText, safeJsonParse } from "../lib/utils.js";
import { loadKnowledge } from "../lib/knowledge.js";
import { extractLikelyItems, mergeItems } from "../lib/extractor.js";
import { checkItems, searchProducts } from "../lib/product-search.js";
import { calculateLeadScore } from "../lib/lead-score.js";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.5";
const FALLBACK_OPENAI_MODEL = process.env.FALLBACK_OPENAI_MODEL || "gpt-5.4-mini";
const STORE_NAME = process.env.STORE_NAME || "Eletro Líder Barretos";
const STORE_CITY = process.env.STORE_CITY || "Barretos/SP";
const STORE_ADDRESS = process.env.STORE_ADDRESS || "Rua 16 nº 89, esquina da Avenida 29, Centro - Barretos/SP";
const STORE_WHATSAPP = process.env.STORE_WHATSAPP || "17 98804-9204";
const STORE_PHONE = process.env.STORE_PHONE || "17 3324-5600";
const RIO_PRETO_LINK = process.env.RIO_PRETO_LINK || "https://wa.me/5517988160214";
const HUMAN_HANDOFF_MESSAGE = process.env.HUMAN_HANDOFF_MESSAGE || "Para eu não te passar uma informação errada, vou encaminhar sua mensagem para um atendente da Eletro Líder te confirmar certinho.";

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "intent", "handoff", "leadScore", "needsMoreItems", "conversationSummary", "leadData", "items", "nextAction"],
  properties: {
    reply: { type: "string" },
    intent: { type: "string" },
    handoff: { type: "boolean" },
    leadScore: { type: "string", enum: ["frio", "morno", "quente", "muito_quente"] },
    needsMoreItems: { type: "boolean" },
    conversationSummary: { type: "string" },
    nextAction: { type: "string" },
    leadData: {
      type: "object",
      additionalProperties: false,
      required: ["nome", "telefone", "cidade", "bairro", "tipoCliente", "palpite", "primeiroGol"],
      properties: {
        nome: { type: "string" },
        telefone: { type: "string" },
        cidade: { type: "string" },
        bairro: { type: "string" },
        tipoCliente: { type: "string" },
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

function sendJson(res, status, data) {
  return res.status(status).setHeader("Content-Type", "application/json").json(data);
}

function buildPrompt({ knowledge, productMatches, checkedItems, previousSummary }) {
  return `
${knowledge.prompts.system}

${knowledge.prompts.vendedor}

${knowledge.prompts.entrega}

DADOS OFICIAIS:
Loja: ${STORE_NAME}
Cidade: ${STORE_CITY}
Endereço: ${STORE_ADDRESS}
WhatsApp Barretos: ${STORE_WHATSAPP}
Telefone fixo Barretos: ${STORE_PHONE}
Rio Preto: ${RIO_PRETO_LINK}
Vendedores Barretos: Victor, Paula, José Lucas e Felipe.

POLÍTICAS E BASE:
${JSON.stringify({ politicas: knowledge.politicas, enderecos: knowledge.enderecos, vendedores: knowledge.vendedores, campanhas: knowledge.campanhas, faq: knowledge.faq, sazonalidade: knowledge.sazonalidade }, null, 2)}

MEMÓRIA/RESUMO ANTERIOR:
${previousSummary || "Sem resumo anterior."}

PRODUTOS ENCONTRADOS POR BUSCA:
${JSON.stringify(productMatches, null, 2)}

ITENS CAPTADOS E VALIDADOS:
${JSON.stringify(checkedItems, null, 2)}

COMO USAR A BASE DE PRODUTOS:
- Se trabalhamos=true, você pode dizer que trabalhamos com o item.
- Se trabalhamos=false, diga que não encontrou na base e vai confirmar com vendedor.
- Nunca use a base para preço, estoque ou prazo.

RETORNE APENAS JSON VÁLIDO NO SCHEMA.
`;
}

function normalizeAiResult(data, fallbackLeadScore) {
  const leadData = { nome: "", telefone: "", cidade: "", bairro: "", tipoCliente: "", palpite: "", primeiroGol: "", ...(data.leadData || {}) };
  return {
    reply: cleanText(data.reply) || HUMAN_HANDOFF_MESSAGE,
    intent: cleanText(data.intent) || "outro",
    handoff: Boolean(data.handoff),
    leadScore: ["frio", "morno", "quente", "muito_quente"].includes(data.leadScore) ? data.leadScore : fallbackLeadScore,
    needsMoreItems: Boolean(data.needsMoreItems),
    conversationSummary: cleanText(data.conversationSummary),
    nextAction: cleanText(data.nextAction),
    leadData,
    items: Array.isArray(data.items) ? data.items : []
  };
}

async function callOpenAI(payload, model) {
  return client.chat.completions.create({
    model,
    temperature: 0.25,
    messages: [
      { role: "system", content: payload.systemPrompt },
      { role: "user", content: JSON.stringify(payload.userPayload, null, 2) }
    ],
    response_format: { type: "json_schema", json_schema: { name: "eletro_lider_enterprise_response", strict: true, schema: responseSchema } }
  });
}

export default async function handler(req, res) {
  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") return sendJson(res, 200, { ok: true, service: "eletro-lider-enterprise-gpt55", model: OPENAI_MODEL, store: STORE_NAME, webhook: "/api/webhook" });
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "Use POST." });

  try {
    const body = req.body || {};
    const name = cleanText(body.name || body.first_name || body.nome);
    const phone = cleanText(body.phone || body.telefone || body.whatsapp);
    const message = cleanText(body.message || body.text || body.last_text_input || body.mensagem);
    const previousItems = safeJsonParse(body.items || body.previousItems || body.itens, []);
    const previousSummary = cleanText(body.summary || body.conversationSummary || body.resumoConversa);
    const lastIntent = cleanText(body.lastIntent || body.intent);
    const customFields = body.customFields || body.custom_fields || {};

    if (!message) return sendJson(res, 200, { ok: false, reply: HUMAN_HANDOFF_MESSAGE, intent: "outro", handoff: true, leadScore: "morno", needsMoreItems: false, conversationSummary: previousSummary, nextAction: "encaminhar_humano", leadData: { nome: name, telefone: phone, cidade: "", bairro: "", tipoCliente: "", palpite: "", primeiroGol: "" }, items: [], itemsJson: "[]", resumo: "" });

    const knowledge = loadKnowledge();
    const likelyItems = extractLikelyItems(message);
    const merged = mergeItems(previousItems, likelyItems);
    const checkedItems = checkItems(merged);
    const productMatches = likelyItems.map((item) => ({ consulta: item.descricao, encontrados: searchProducts(item.descricao, Number(process.env.MAX_PRODUCT_MATCHES || 10)) }));
    const initialScore = calculateLeadScore({ message, items: checkedItems, intent: lastIntent });
    const userPayload = { nome_recebido: name, telefone_recebido: phone, mensagem_cliente: message, ultima_intencao: lastIntent, resumo_anterior: previousSummary, itens_detectados_nesta_mensagem: likelyItems, itens_acumulados: checkedItems, campos_personalizados: customFields };
    const systemPrompt = buildPrompt({ knowledge, productMatches, checkedItems, previousSummary });

    let completion;
    try { completion = await callOpenAI({ systemPrompt, userPayload }, OPENAI_MODEL); }
    catch (err) { console.error("Falha modelo principal, tentando fallback:", err?.message || err); completion = await callOpenAI({ systemPrompt, userPayload }, FALLBACK_OPENAI_MODEL); }

    const content = completion.choices?.[0]?.message?.content || "{}";
    const ai = normalizeAiResult(JSON.parse(content), initialScore);
    if (!ai.leadData.nome && name) ai.leadData.nome = name;
    if (!ai.leadData.telefone && phone) ai.leadData.telefone = phone;
    const finalItems = checkItems(mergeItems(checkedItems, ai.items));
    const resumo = finalItems.map((item) => `• ${item.descricao}${item.quantidade ? ` — ${item.quantidade}` : ""} (${item.trabalhamos ? "trabalhamos" : "confirmar com vendedor"})`).join("\n");
    const finalScore = calculateLeadScore({ message, items: finalItems, intent: ai.intent });
    ai.leadScore = ["quente", "muito_quente"].includes(finalScore) ? finalScore : ai.leadScore;

    return sendJson(res, 200, { ok: true, reply: ai.reply, intent: ai.intent, handoff: ai.handoff, leadScore: ai.leadScore, needsMoreItems: ai.needsMoreItems, conversationSummary: ai.conversationSummary, nextAction: ai.nextAction, leadData: ai.leadData, items: finalItems, itemsJson: JSON.stringify(finalItems), resumo, contatos: { barretos: { whatsapp: STORE_WHATSAPP, fixo: STORE_PHONE, endereco: STORE_ADDRESS }, rioPreto: { link: RIO_PRETO_LINK } } });
  } catch (error) {
    console.error("Erro no webhook:", error);
    return sendJson(res, 200, { ok: false, reply: HUMAN_HANDOFF_MESSAGE, intent: "outro", handoff: true, leadScore: "morno", needsMoreItems: false, conversationSummary: "", nextAction: "encaminhar_humano", leadData: { nome: "", telefone: "", cidade: "", bairro: "", tipoCliente: "", palpite: "", primeiroGol: "" }, items: [], itemsJson: "[]", resumo: "", error: "Falha ao processar atendimento." });
  }
}
