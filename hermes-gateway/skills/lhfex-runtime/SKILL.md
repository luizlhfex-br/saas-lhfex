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

## Comandos base

### Provider e modelo

```bash
hermes status
```

### Variaveis criticas

```bash
printf 'SAAS_URL=%s\nOPENCLAW_TOOLS_API_KEY=%s\n' "${SAAS_URL:-}" "${OPENCLAW_TOOLS_API_KEY:+set}"
```

### Verificar acesso ao SaaS

```bash
curl -sS "${SAAS_URL}/api/openclaw-tools?action=catalogo_acoes" \
  -H "X-OpenClaw-Key: ${OPENCLAW_TOOLS_API_KEY}"
```

### Verificar Google via SaaS

```bash
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
- acesso ao SaaS: informar se o endpoint respondeu e citar a evidence curta
- Google: informar `connected=true/false`
- host/VPS: informar hostname/cwd ou outra evidence objetiva
