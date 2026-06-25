import OpenAI from "openai";
import { cors, clean, safeJson, truth } from "../lib/utils.js";
import { loadData } from "../lib/data-loader.js";
import { extractItems, mergeItems, customerClosedCart } from "../lib/items.js";
import { checkProducts, searchProducts } from "../lib/products.js";
import { pickAttachmentUrl, detectFileType } from "../lib/attachment.js";
import { readAttachment } from "../lib/vision.js";
import { loadMemory, saveMemory, buildMemoryContext } from "../lib/memory.js";
import { leadScore } from "../lib/score.js";
import { fastReply } from "../lib/fast.js";
import { getCrossSellSuggestions } from "../lib/cross-sell.js";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MODEL = process.env.OPENAI_MODEL || "gpt-5.5";
const FALLBACK_MODEL = process.env.FALLBACK_OPENAI_MODEL || "gpt-5.4-mini";
const STORE_NAME = process.env.STORE_NAME || "Eletro Líder Barretos";
const STORE_ADDRESS = process.env.STORE_ADDRESS || "Rua 16 nº 89, esquina da Avenida 29, Centro - Barretos/SP";
const STORE_WHATSAPP = process.env.STORE_WHATSAPP || "17 98804-9204";
const STORE_PHONE = process.env.STORE_PHONE || "17 3324-5600";
const RIO_PRETO_LINK = process.env.RIO_PRETO_LINK || "https://wa.me/5517988160214";
const HUMAN_MESSAGE = process.env.HUMAN_HANDOFF_MESSAGE || "Para eu não te passar uma informação errada, vou encaminhar sua mensagem para um atendente da Eletro Líder te confirmar certinho.";

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "reply", "intent", "handoff", "leadScore", "needsMoreItems",
    "conversationSummary", "leadData", "items", "nextAction",
    "attachmentSummary", "crossSellSuggestions"
  ],
  properties: {
    reply: { type: "string" },
    intent: { type: "string" },
    handoff: { type: "boolean" },
    leadScore: { type: "string", enum: ["frio", "morno", "quente", "muito_quente"] },
    needsMoreItems: { type: "boolean" },
    conversationSummary: { type: "string" },
    nextAction: { type: "string" },
    attachmentSummary: { type: "string" },
    crossSellSuggestions: { type: "array", items: { type: "string" } },
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

function buildPrompt({ data, memory, productMatches, checkedItems, previousSummary, attachmentRead, closeCart, crossSell }) {
  return `
${data.prompts.system}

${data.prompts.vendedor}

${data.prompts.entrega}

${data.prompts.memoria}

${data.prompts.crossSell}

DADOS DA LOJA:
${JSON.stringify({
  nome: STORE_NAME,
  endereco: STORE_ADDRESS,
  whatsapp: STORE_WHATSAPP,
  telefone: STORE_PHONE,
  rioPreto: RIO_PRETO_LINK,
  vendedores: ["Victor", "Paula", "José Lucas", "Felipe"]
}, null, 2)}

BASE DE POLÍTICAS:
${JSON.stringify(data.politicas, null, 2)}

MEMÓRIA DO CLIENTE:
${JSON.stringify(memory || {}, null, 2)}

RESUMO ANTERIOR DO MANYCHAT:
${previousSummary || "Sem resumo anterior."}

LEITURA DE IMAGEM/PDF:
${JSON.stringify(attachmentRead || {}, null, 2)}

PRODUTOS ENCONTRADOS POR BUSCA:
${JSON.stringify(productMatches, null, 2)}

ITENS CAPTADOS E VALIDADOS:
${JSON.stringify(checkedItems, null, 2)}

SUGESTÕES COMPLEMENTARES POSSÍVEIS:
${JSON.stringify(crossSell, null, 2)}

REGRAS DO CARRINHO:
- Mantenha os itens já captados.
- Se faltar quantidade, peça somente o que falta.
- Se o cliente enviou imagem/PDF, diga que leu o arquivo e organize os itens encontrados.
- Se a leitura do arquivo estiver baixa ou duvidosa, peça reenvio mais nítido ou confirmação dos itens.
- Se o cliente indicar que terminou a lista, monte resumo e handoff=true.
- Cliente indicou fechamento/finalização: ${closeCart ? "SIM" : "NÃO"}.

COMO USAR A BASE:
- Se trabalhamos=true, pode dizer que trabalhamos com o item.
- Se trabalhamos=false, diga que não encontrou na base e vai confirmar com vendedor.
- Nunca use a base para preço, estoque ou prazo.

DIRECIONAMENTO SEM GATILHO:
- Toda mensagem deve ser classificada e direcionada.
- Se for orçamento/lista/arquivo, captar itens.
- Se for entrega, aplicar política de entrega.
- Se for Rio Preto, passar link.
- Se for atendimento humano, handoff=true.
- Se não entender, perguntar de forma simples o que o cliente precisa.

RETORNE APENAS JSON VÁLIDO NO SCHEMA.
`;
}

async function callOpenAI({ systemPrompt, userPayload }, model) {
  return client.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: JSON.stringify(userPayload, null, 2) }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "eletro_lider_v6",
        strict: true,
        schema: responseSchema
      }
    }
  });
}

function normalizeAi(data, fallbackScore) {
  const leadData = {
    nome: "",
    telefone: "",
    cidade: "",
    bairro: "",
    tipoCliente: "",
    palpite: "",
    primeiroGol: "",
    ...(data.leadData || {})
  };

  return {
    reply: clean(data.reply) || HUMAN_MESSAGE,
    intent: clean(data.intent) || "outro",
    handoff: Boolean(data.handoff),
    leadScore: ["frio", "morno", "quente", "muito_quente"].includes(data.leadScore) ? data.leadScore : fallbackScore,
    needsMoreItems: Boolean(data.needsMoreItems),
    conversationSummary: clean(data.conversationSummary),
    nextAction: clean(data.nextAction),
    attachmentSummary: clean(data.attachmentSummary),
    crossSellSuggestions: Array.isArray(data.crossSellSuggestions) ? data.crossSellSuggestions : [],
    leadData,
    items: Array.isArray(data.items) ? data.items : []
  };
}

function buildResumo(items) {
  return items.map((item) => {
    const status = item.trabalhamos ? "trabalhamos" : "confirmar com vendedor";
    return `• ${item.descricao}${item.quantidade ? ` — ${item.quantidade}` : ""} (${status})`;
  }).join("\n");
}

export default async function handler(req, res) {
  Object.entries(cors()).forEach(([key, value]) => res.setHeader(key, value));

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    return sendJson(res, 200, {
      ok: true,
      service: "eletro-lider-enterprise-v6",
      model: MODEL,
      vision: truth(process.env.ENABLE_ATTACHMENT_READING ?? "true"),
      memory: truth(process.env.ENABLE_MEMORY ?? "true"),
      store: STORE_NAME,
      webhook: "/api/webhook"
    });
  }

  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "Use POST." });

  try {
    const body = req.body || {};

    const name = clean(body.name || body.first_name || body.nome);
    const phone = clean(body.phone || body.telefone || body.whatsapp || body.contact_id);
    const message = clean(body.message || body.text || body.last_text_input || body.mensagem);
    const previousItems = safeJson(body.items || body.previousItems || body.itens, []);
    const previousSummary = clean(body.summary || body.conversationSummary || body.resumoConversa);
    const lastIntent = clean(body.lastIntent || body.intent);
    const customFields = body.customFields || body.custom_fields || {};
    const attachmentUrl = pickAttachmentUrl(body);
    const hasAttachment = Boolean(attachmentUrl);

    if (!message && !hasAttachment) {
      return sendJson(res, 200, {
        ok: false,
        reply: HUMAN_MESSAGE,
        intent: "outro",
        handoff: true,
        leadScore: "morno",
        needsMoreItems: false,
        conversationSummary: previousSummary,
        nextAction: "encaminhar_humano",
        attachmentSummary: "",
        crossSellSuggestions: [],
        leadData: { nome: name, telefone: phone, cidade: "", bairro: "", tipoCliente: "", palpite: "", primeiroGol: "" },
        items: [],
        itemsJson: "[]",
        resumo: ""
      });
    }

    const data = loadData();

    if (!hasAttachment && truth(process.env.ENABLE_FAST_REPLY ?? "true")) {
      const fast = fastReply(message);

      if (fast && (!Array.isArray(previousItems) || !previousItems.length)) {
        return sendJson(res, 200, {
          ok: true,
          reply: fast.reply,
          intent: fast.intent,
          handoff: false,
          leadScore: "frio",
          needsMoreItems: false,
          conversationSummary: `Cliente enviou: ${message}. Resposta rápida: ${fast.intent}.`,
          nextAction: "continuar_conversa",
          attachmentSummary: "",
          crossSellSuggestions: [],
          leadData: { nome: name, telefone: phone, cidade: "", bairro: "", tipoCliente: "", palpite: "", primeiroGol: "" },
          items: [],
          itemsJson: "[]",
          resumo: "",
          contatos: {
            barretos: { whatsapp: STORE_WHATSAPP, fixo: STORE_PHONE, endereco: STORE_ADDRESS },
            rioPreto: { link: RIO_PRETO_LINK }
          }
        });
      }
    }

    const memoryEnabled = truth(process.env.ENABLE_MEMORY ?? "true");
    const existingMemory = memoryEnabled ? loadMemory(phone || name || "anonimo") : null;

    let attachmentRead = null;
    let attachmentItems = [];

    if (hasAttachment && truth(process.env.ENABLE_ATTACHMENT_READING ?? "true")) {
      attachmentRead = await readAttachment({ url: attachmentUrl, message });
      attachmentItems = Array.isArray(attachmentRead.items) ? attachmentRead.items : [];
    }

    const combinedMessage = [
      message,
      attachmentRead?.transcription ? `\nTRANSCRIÇÃO DO ARQUIVO:\n${attachmentRead.transcription}` : ""
    ].join("\n").trim();

    const textItems = extractItems(combinedMessage);
    const likelyItems = mergeItems(textItems, attachmentItems);
    const merged = mergeItems(previousItems, likelyItems);
    const checkedItems = checkProducts(merged);
    const closeCart = customerClosedCart(message);

    const productMatches = likelyItems.map((item) => ({
      consulta: item.descricao,
      encontrados: searchProducts(item.descricao, Number(process.env.MAX_PRODUCT_MATCHES || 15))
    }));

    const memoryContext = buildMemoryContext({
      existing: existingMemory,
      name,
      phone,
      summary: previousSummary,
      items: checkedItems
    });

    const crossSell = truth(process.env.ENABLE_CROSS_SELL ?? "true")
      ? getCrossSellSuggestions(checkedItems)
      : [];

    const initialScore = leadScore({
      message: combinedMessage,
      items: checkedItems,
      intent: lastIntent,
      hasAttachment
    });

    const userPayload = {
      nome_recebido: name,
      telefone_recebido: phone,
      mensagem_cliente: message,
      arquivo_recebido: hasAttachment,
      arquivo_url: attachmentUrl,
      arquivo_tipo: detectFileType(attachmentUrl),
      leitura_arquivo: attachmentRead,
      ultima_intencao: lastIntent,
      resumo_anterior: previousSummary,
      memoria_cliente: memoryContext,
      itens_detectados: likelyItems,
      itens_acumulados: checkedItems,
      cliente_indicou_fechamento: closeCart,
      sugestoes_complementares: crossSell,
      campos_personalizados: customFields
    };

    const systemPrompt = buildPrompt({
      data,
      memory: memoryContext,
      productMatches,
      checkedItems,
      previousSummary,
      attachmentRead,
      closeCart,
      crossSell
    });

    let completion;

    try {
      completion = await callOpenAI({ systemPrompt, userPayload }, MODEL);
    } catch (error) {
      console.error("modelo principal falhou", error?.message || error);
      completion = await callOpenAI({ systemPrompt, userPayload }, FALLBACK_MODEL);
    }

    const content = completion.choices?.[0]?.message?.content || "{}";
    const ai = normalizeAi(JSON.parse(content), initialScore);

    if (!ai.leadData.nome && name) ai.leadData.nome = name;
    if (!ai.leadData.telefone && phone) ai.leadData.telefone = phone;

    const finalItems = checkProducts(mergeItems(checkedItems, ai.items));
    const resumo = buildResumo(finalItems);

    const finalScore = leadScore({
      message: combinedMessage,
      items: finalItems,
      intent: ai.intent,
      hasAttachment
    });

    ai.leadScore = ["quente", "muito_quente"].includes(finalScore) ? finalScore : ai.leadScore;

    if (hasAttachment || closeCart || ["quente", "muito_quente"].includes(ai.leadScore)) {
      ai.handoff = true;
      if (!ai.nextAction) ai.nextAction = "encaminhar_vendedor";
    }

    if (memoryEnabled) {
      saveMemory(phone || name || "anonimo", {
        nome: ai.leadData.nome || name,
        telefone: ai.leadData.telefone || phone,
        resumo: ai.conversationSummary || previousSummary,
        itens: finalItems,
        ultimaIntencao: ai.intent,
        ultimoLeadScore: ai.leadScore,
        conversas: [
          ...(existingMemory?.conversas || []).slice(-10),
          { cliente: message, resposta: ai.reply, intent: ai.intent, leadScore: ai.leadScore }
        ]
      });
    }

    return sendJson(res, 200, {
      ok: true,
      reply: ai.reply,
      intent: ai.intent,
      handoff: ai.handoff,
      leadScore: ai.leadScore,
      needsMoreItems: ai.needsMoreItems,
      conversationSummary: ai.conversationSummary,
      nextAction: ai.nextAction,
      attachmentUrl,
      attachmentType: detectFileType(attachmentUrl),
      attachmentSummary: ai.attachmentSummary || attachmentRead?.transcription || "",
      attachmentConfidence: attachmentRead?.confidence || "",
      needsBetterImage: Boolean(attachmentRead?.needsBetterImage),
      crossSellSuggestions: ai.crossSellSuggestions.length ? ai.crossSellSuggestions : crossSell,
      leadData: ai.leadData,
      items: finalItems,
      itemsJson: JSON.stringify(finalItems),
      resumo,
      contatos: {
        barretos: { whatsapp: STORE_WHATSAPP, fixo: STORE_PHONE, endereco: STORE_ADDRESS },
        rioPreto: { link: RIO_PRETO_LINK }
      }
    });
  } catch (error) {
    console.error("Erro webhook", error);

    return sendJson(res, 200, {
      ok: false,
      reply: HUMAN_MESSAGE,
      intent: "outro",
      handoff: true,
      leadScore: "morno",
      needsMoreItems: false,
      conversationSummary: "",
      nextAction: "encaminhar_humano",
      attachmentSummary: "",
      crossSellSuggestions: [],
      leadData: { nome: "", telefone: "", cidade: "", bairro: "", tipoCliente: "", palpite: "", primeiroGol: "" },
      items: [],
      itemsJson: "[]",
      resumo: "",
      error: "Falha ao processar atendimento."
    });
  }
}
