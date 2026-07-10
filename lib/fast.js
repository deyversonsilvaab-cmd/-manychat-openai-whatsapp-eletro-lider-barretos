import { norm } from "./utils.js";

const HORARIO_WORDS = new Set([
      "HORARIO",
      "FUNCIONAMENTO",
      "FUNCIONA",
      "ABERTO",
      "ABERTOS",
      "ABERTA",
      "ABRE",
      "ABREM",
      "ABRIU",
      "FECHA",
      "FECHAM",
      "FECHOU",
      "FECHADO"
    ]);

const HORARIO_PHRASES = [
      "QUE HORAS",
      "ESTA ABERTO",
      "ESTAO ABERTO",
      "ABERTO HOJE",
      "HORAS FUNCIONA"
    ];

function isHorarioQuestion(text) {
      const words = text.split(" ").filter(Boolean);
      if (words.some((w) => HORARIO_WORDS.has(w))) return true;
      return HORARIO_PHRASES.some((p) => text.includes(p));
}

export function fastReply(message = "") {
      const text = norm(message);

  if (["OI", "OLA", "OLÁ", "BOM DIA", "BOA TARDE", "BOA NOITE"].includes(text)) {
          return {
                    reply: "Olá! Tudo bem? Sou da Eletro Líder Barretos. Me diga o que você precisa que eu já te ajudo.",
                    intent: "saudacao"
          };
  }

  if (text.includes("ENDERECO") || text.includes("ENDEREÇO") || text.includes("ONDE FICA")) {
          return {
                    reply: "Estamos na Rua 16 nº 89, esquina da Avenida 29, Centro - Barretos/SP. WhatsApp: 17 98804-9204. Telefone fixo: 17 3324-5600.",
                    intent: "endereco"
          };
  }

  if (isHorarioQuestion(text)) {
          return {
                    reply: "Nosso horário de funcionamento é de Segunda a Sexta das 08:00 às 18:00, e aos Sábados das 08:00 às 12:00. Já aproveita e me conta o que você precisa que eu já te ajudo agora mesmo!",
                    intent: "horario_funcionamento"
          };
  }

  return null;
}
