import { norm } from "./utils.js";

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

  if (
        text.includes("HORARIO") ||
        text.includes("HORAS FUNCIONA") ||
        text.includes("QUE HORAS") ||
        text.includes("FUNCIONAMENTO") ||
        text.includes("ESTA ABERTO") ||
        text.includes("ESTAO ABERTO") ||
        text.includes("ABERTO HOJE") ||
        text.includes("ABREM") ||
        text.includes("FECHAM") ||
        (text.includes("ABRE") && !text.includes("ABREVIA")) ||
        text.includes("FECHA")
      ) {
        return {
                reply: "Nosso horário de funcionamento é de Segunda a Sexta das 08:00 às 18:00, e aos Sábados das 08:00 às 12:00. Já aproveita e me conta o que você precisa que eu já te ajudo agora mesmo!",
                intent: "horario_funcionamento"
        };
  }

  return null;
}
