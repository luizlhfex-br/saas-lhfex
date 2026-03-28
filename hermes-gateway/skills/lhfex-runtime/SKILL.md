---
name: lhfex-runtime
description: Diagnostico operacional do Hermes LHFEX para provider, modelo, acessos, ambiente e prontidao do agente
version: 1.0.0
metadata:
  hermes:
    tags: [lhfex, runtime, diagnostico, provider, acesso]
    related_skills: [lhfex-saas, lhfex-squad-router]
---

# LHFEX Runtime

## Objetivo

Responder perguntas sobre o proprio agente com evidencia real do ambiente.

## Quando usar

- "qual LLM voce esta usando?"
- "qual provider esta ativo?"
- "o que falta para acessar o SaaS?"
- "o Google esta conectado?"
- "voce tem acesso ao host/VPS?"
- "o Telegram esta configurado?"

## Regras

1. Nunca responder por memoria presumida; validar no runtime.
2. Nunca dizer que faltam variaveis sem verificar o ambiente real.
3. Para acesso ao SaaS, sempre validar `catalogo_acoes` antes de concluir.
4. Para Google, sempre validar `google_status`.
5. Para modelo/provider, sempre validar `hermes status`.
5.1 Para a versao do proprio agente, sempre validar `hermes version`.
6. Se o sandbox nao herdar PATH ou env do gateway, usar caminhos absolutos e `. /root/.hermes/.env` antes de concluir que algo esta ausente.
7. Se a checagem real funcionar, dizer explicitamente que o acesso ja esta ativo.
8. Nao mandar o usuario configurar URL, token ou login se o ambiente validado ja estiver pronto.
9. Se a ferramenta mostrar segredo como `abc123...7890`, isso e mascaramento de segredo. Nao chamar isso de chave truncada sem falha real no endpoint.
10. Se `catalogo_acoes` retornar `200`, nao pedir `OPENCLAW_TOOLS_API_KEY` ao Luiz.

## Comandos base

### Provider e modelo

```bash
/root/.local/bin/hermes status
```

### Versao do Hermes

```bash
/root/.local/bin/hermes version
```

### Variaveis criticas

```bash
set -a
. /root/.hermes/.env
printf 'SAAS_URL=%s\nOPENCLAW_TOOLS_API_KEY=%s\n' "${SAAS_URL:-}" "${OPENCLAW_TOOLS_API_KEY:+set}"
```

Se o runtime mascarar o valor como `prefixo...sufixo`, isso continua valendo como segredo presente.

### Verificar acesso ao SaaS

```bash
set -a
. /root/.hermes/.env
curl -sS "${SAAS_URL}/api/openclaw-tools?action=catalogo_acoes" \
  -H "X-OpenClaw-Key: ${OPENCLAW_TOOLS_API_KEY}"
```

### Verificar Google via SaaS

```bash
set -a
. /root/.hermes/.env
curl -sS "${SAAS_URL}/api/openclaw-tools?action=google_status" \
  -H "X-OpenClaw-Key: ${OPENCLAW_TOOLS_API_KEY}"
```

### Verificar host

```bash
hostname
pwd
```

## Resposta esperada

- provider/modelo: informar exatamente o que `hermes status` mostrar
- versao do Hermes: informar exatamente o que `hermes version` mostrar
- acesso ao SaaS: informar se o endpoint respondeu e citar a evidence curta
- Google: informar `connected=true/false`
- host/VPS: informar hostname/cwd ou outra evidence objetiva
- sempre fechar com proximo passo quando faltar algo
