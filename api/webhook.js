import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const STORE_NAME = process.env.STORE_NAME || "Eletro Líder Barretos";
const STORE_CITY = process.env.STORE_CITY || "Barretos/SP";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const HUMAN_HANDOFF_MESSAGE =
  process.env.HUMAN_HANDOFF_MESSAGE ||
  "Para eu não te passar uma informação errada, vou encaminhar sua mensagem para um atendente da Eletro Líder te confirmar certinho.";

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "intent", "handoff", "leadData"],
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
        "outro"
      ]
    },
    handoff: { type: "boolean" },
    leadData: {
      type: "object",
      additionalProperties: false,
      required: [
        "nome",
        "telefone",
        "produto",
        "quantidade",
        "cidade",
        "palpite",
        "primeiroGol"
      ],
      properties: {
        nome: { type: "string" },
        telefone: { type: "string" },
        produto: { type: "string" },
        quantidade: { type: "string" },
        cidade: { type: "string" },
        palpite: { type: "string" },
        primeiroGol: { type: "string" }
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

function buildSystemPrompt() {
  return `
Você é o atendente virtual da ${STORE_NAME}, loja de materiais elétricos e iluminação em ${STORE_CITY}.

PERSONALIDADE:
- Atendimento humanizado, simples, educado, profissional, comercial, sutil e harmônico.
- Linguagem natural de WhatsApp.
- Poucos emojis.
- Tom de loja próxima do cliente.
- Postura de vendedor consultivo.

REGRAS OBRIGATÓRIAS:
1. Não informe preço se o preço não foi passado no contexto.
2. Não invente produtos.
3. Não invente marcas.
4. Não invente estoque.
5. Não invente prazo de entrega.
6. Não invente promoção.
7. Não afirme que tem produto disponível sem confirmação.
8. Não prometa desconto sem autorização.
9. Não dê informação técnica insegura.
10. Não responda com certeza quando não souber.
11. Não crie informação falsa.
12. Não fale em nome de vendedor específico, a menos que o nome venha no contexto.
13. Não finalize atendimento quando houver dúvida comercial importante.
14. Quando faltar informação, encaminhe para atendente humano.
15. Quando o cliente pedir preço, estoque, orçamento, disponibilidade ou prazo, colete os dados básicos e marque handoff como true.
16. Quando a dúvida envolver risco elétrico, norma, instalação ou dimensionamento, responda com cautela e marque handoff como true.

INTENÇÕES POSSÍVEIS:
saudacao, pedido_orcamento, consulta_preco, consulta_estoque, produto_especifico, material_eletrico, iluminacao, eletricista_parceiro, campanha_hora_do_chute, duvida_tecnica, endereco_horario, reclamacao, financeiro, falar_com_atendente, outro.

REGRAS DE HANDOFF:
handoff = true quando:
- cliente pedir preço;
- cliente pedir estoque;
- cliente pedir orçamento;
- cliente pedir atendimento humano;
- cliente fizer reclamação;
- cliente pedir informação técnica sensível;
- você não souber responder;
- mensagem estiver confusa;
- cliente demonstrar intenção clara de compra;
- cliente pedir prazo de entrega.

handoff = false quando:
- saudação simples;
- você estiver pedindo mais dados;
- cliente enviar palpite da campanha e os dados forem identificados;
- pergunta simples dentro da base conhecida.

CAMPANHA HORA DO CHUTE:
Se o cliente enviar palpite, extraia placar e minuto do primeiro gol.
Exemplo: "Brasil 2x0, primeiro gol 22 minutos".
Retorne confirmação curta.
Não invente regras além das disponíveis.

QUANDO NÃO SOUBER:
Use uma resposta parecida com:
"${HUMAN_HANDOFF_MESSAGE}"

FORMATO:
Responda apenas em JSON válido, seguindo o schema solicitado.
`;
}

function validateAiJson(data) {
  if (!data || typeof data !== "object") throw new Error("Resposta da IA não é objeto.");
  if (typeof data.reply !== "string") throw new Error("Campo reply inválido.");
  if (typeof data.intent !== "string") throw new Error("Campo intent inválido.");
  if (typeof data.handoff !== "boolean") throw new Error("Campo handoff inválido.");
  if (!data.leadData || typeof data.leadData !== "object") {
    throw new Error("Campo leadData inválido.");
  }

  const fields = ["nome", "telefone", "produto", "quantidade", "cidade", "palpite", "primeiroGol"];
  for (const field of fields) {
    if (typeof data.leadData[field] !== "string") data.leadData[field] = "";
  }

  return data;
}

async function generateReply({ name, phone, message, customFields }) {
  const userPayload = {
    nome_recebido: name,
    telefone_recebido: phone,
    mensagem_cliente: message,
    campos_personalizados: customFields || {}
  };

  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content: buildSystemPrompt()
      },
      {
        role: "user",
        content: JSON.stringify(userPayload, null, 2)
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "manychat_eletro_lider_response",
        strict: true,
        schema: responseSchema
      }
    }
  });

  const content = completion.choices?.[0]?.message?.content || "{}";
  return validateAiJson(JSON.parse(content));
}

export default async function handler(req, res) {
  Object.entries(corsHeaders()).forEach(([key, value]) => res.setHeader(key, value));

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    return sendJson(res, 200, {
      ok: true,
      service: "manychat-openai-whatsapp",
      store: STORE_NAME,
      city: STORE_CITY
    });
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, {
      ok: false,
      error: "Método não permitido. Use POST."
    });
  }

  try {
    const body = req.body || {};

    const name = cleanText(body.name || body.first_name || body.nome);
    const phone = cleanText(body.phone || body.whatsapp || body.telefone);
    const message = cleanText(body.message || body.text || body.last_text_input || body.mensagem);
    const customFields = body.customFields || body.custom_fields || {};

    if (!message) {
      return sendJson(res, 400, {
        ok: false,
        reply: HUMAN_HANDOFF_MESSAGE,
        intent: "outro",
        handoff: true,
        leadData: {
          nome: name,
          telefone: phone,
          produto: "",
          quantidade: "",
          cidade: "",
          palpite: "",
          primeiroGol: ""
        },
        error: "Mensagem vazia."
      });
    }

    const aiResult = await generateReply({
      name,
      phone,
      message,
      customFields
    });

    if (!aiResult.leadData.nome && name) aiResult.leadData.nome = name;
    if (!aiResult.leadData.telefone && phone) aiResult.leadData.telefone = phone;

    return sendJson(res, 200, {
      ok: true,
      reply: aiResult.reply,
      intent: aiResult.intent,
      handoff: aiResult.handoff,
      leadData: aiResult.leadData,
      palpite: aiResult.leadData.palpite,
      primeiroGol: aiResult.leadData.primeiroGol,
      produto: aiResult.leadData.produto,
      quantidade: aiResult.leadData.quantidade,
      cidade: aiResult.leadData.cidade
    });
  } catch (error) {
    console.error("Erro no webhook:", error);

    return sendJson(res, 200, {
      ok: false,
      reply: HUMAN_HANDOFF_MESSAGE,
      intent: "outro",
      handoff: true,
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
