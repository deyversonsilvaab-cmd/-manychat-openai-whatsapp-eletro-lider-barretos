# Variáveis de ambiente para Vercel

Cadastre estas variáveis em:

Vercel → Projeto → Settings → Environment Variables

```env
OPENAI_API_KEY=sua_chave_nova_da_openai
OPENAI_MODEL=gpt-4.1-mini
STORE_NAME=Eletro Líder Barretos
STORE_CITY=Barretos/SP
STORE_ADDRESS=Rua 16 nº 89, esquina da Avenida 29, Centro - Barretos/SP
STORE_WHATSAPP=17 98804-9204
STORE_PHONE=17 3324-5600
RIO_PRETO_WHATSAPP=17 98816-0214
RIO_PRETO_LINK=https://wa.me/5517988160214
DELIVERY_MINIMUM_ORDER=50.00
DELIVERY_CITY=Barretos
DELIVERY_EXCLUDED_NEIGHBORHOOD=Vida Nova
HUMAN_HANDOFF_MESSAGE=Para eu não te passar uma informação errada, vou encaminhar sua mensagem para um atendente da Eletro Líder te confirmar certinho.
```

Depois de alterar variáveis, faça:

Deployments → último deploy → Redeploy
