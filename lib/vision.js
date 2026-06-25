import OpenAI from "openai";
import { detectFileType } from "./attachment.js";
import { loadData } from "./data-loader.js";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const VISION_MODEL = process.env.VISION_MODEL || process.env.OPENAI_MODEL || "gpt-5.5";

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["transcription", "items", "confidence", "needsBetterImage"],
  properties: {
    transcription: { type: "string" },
    confidence: { type: "string", enum: ["alta", "media", "baixa"] },
    needsBetterImage: { type: "boolean" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["descricao", "quantidade", "observacao"],
        properties: {
          descricao: { type: "string" },
          quantidade: { type: "string" },
          observacao: { type: "string" }
        }
      }
    }
  }
};

export async function readAttachment({ url, message = "" }) {
  const data = loadData();

  if (!url) {
    return { transcription: "", items: [], confidence: "baixa", needsBetterImage: false };
  }

  const fileType = detectFileType(url);
  const prompt = `${data.prompts.ocr}

Mensagem do cliente:
${message || "Sem mensagem."}

URL:
${url}

Tipo detectado:
${fileType}`;

  try {
    const content = [{ type: "text", text: prompt }];

    if (fileType === "image" || fileType === "unknown") {
      content.push({ type: "image_url", image_url: { url } });
    } else {
      content.push({
        type: "text",
        text: "O arquivo parece ser PDF. Se não conseguir ler, solicite print ou foto nítida da lista."
      });
    }

    const completion = await client.chat.completions.create({
      model: VISION_MODEL,
      temperature: 0,
      messages: [{ role: "user", content }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "ocr_orcamento",
          strict: true,
          schema
        }
      }
    });

    return JSON.parse(completion.choices?.[0]?.message?.content || "{}");
  } catch (error) {
    console.error("vision error", error?.message || error);
    return {
      transcription: "",
      items: [],
      confidence: "baixa",
      needsBetterImage: true,
      error: "Falha ao interpretar arquivo."
    };
  }
}
