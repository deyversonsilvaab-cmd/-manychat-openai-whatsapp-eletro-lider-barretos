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

  return null;
}
