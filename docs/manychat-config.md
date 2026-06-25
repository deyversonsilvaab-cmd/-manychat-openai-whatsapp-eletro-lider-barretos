# Configuração ManyChat

1. Criar gatilho de mensagem.
2. Adicionar Solicitação Externa.
3. Método POST.
4. URL: `https://SEU-PROJETO.vercel.app/api/webhook`
5. Body JSON conforme `examples/manychat-body.json`.
6. Mapear respostas.
7. Próximo passo: Enviar Mensagem `{{cf_ai_reply}}`.
8. Se `cf_ai_handoff = true`, adicionar tag `ATENDIMENTO_HUMANO` e notificar vendedor.
