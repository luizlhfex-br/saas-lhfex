# RUNBOOK — openclaw-gateway

> Guia de operação e troubleshooting do container openclaw-ai no Coolify.
> Criado em 2026-03-02 após 6 bugs corrigidos em sessões de deploy.

---

## 1. Env Vars obrigatórias no Coolify

Acesse: `http://72.60.151.145:8000` → openclaw-ai → **Environment Variables**

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `TELEGRAM_OPENCLAW_BOT_TOKEN` | ✅ SIM | Token do bot @lhfex_openclaw_bot |
| `GEMINI_API_KEY` | ✅ SIM | Chave do Google AI Studio (gemini-2.0-flash) |
| `OPENROUTER_API_KEY` | ✅ SIM | Chave do OpenRouter (fallback deepseek + outros modelos) |
| `GITHUB_BACKUP_TOKEN` | Recomendado | PAT do GitHub para backup da memória no branch `openclaw-memory` |
| `GITHUB_BACKUP_REPO` | Recomendado | ex: `lhfex/saas-lhfex` (repo onde salva a memória) |
| `SLACK_BOT_TOKEN` | Opcional | Somente se Slack estiver habilitado no openclaw.json |

---

## 2. Bugs Corrigidos (histórico)

### Bug 1 — Alpine + node-llama-cpp (`commit 4435342`)
**Sintoma:** Build falha com `cmake not found` ou similar.
**Causa:** `openclaw` depende de `node-llama-cpp` que precisa de binários pré-compilados para Debian/glibc. Alpine usa musl libc + não tem cmake.
**Fix:** `FROM node:22-slim` (Debian) em vez de `FROM node:22-alpine`.

---

### Bug 2 — gateway.mode=local ausente (`commit 955d0eb`)
**Sintoma:** Runtime log: `"Gateway start blocked: set gateway.mode=local or pass --allow-unconfigured."`
**Causa:** openclaw requer campo `gateway.mode` explícito.
**Fix:** `openclaw.json` → `"gateway": { "mode": "local", ... }`

---

### Bug 3 — SSH git URL bloqueada no Docker (`commits e0c48b0 → 9726655`)
**Sintoma:** `npm install` falha com `git ls-remote ssh://...` exit 128.
**Causa:** `openclaw@2026.2.26` → `@whiskeysockets/baileys` → `libsignal-node` via `git+ssh://` URL. Docker sem SSH keys.
**Fix (solução final):** Usar `GIT_CONFIG_COUNT/KEY_n/VALUE_n` env vars no Dockerfile (prioridade máxima, sobrepõe tudo):
```dockerfile
ENV GIT_CONFIG_COUNT=3 \
    GIT_CONFIG_KEY_0="url.https://github.com/.insteadof" \
    GIT_CONFIG_VALUE_0="ssh://git@github.com/" \
    GIT_CONFIG_KEY_1="url.https://github.com/.insteadof" \
    GIT_CONFIG_VALUE_1="git+ssh://git@github.com/" \
    GIT_CONFIG_KEY_2="url.https://github.com/.insteadof" \
    GIT_CONFIG_VALUE_2="git://github.com/"
```

**Armadilha:** `git config --global url.X.insteadOf` (sem `--add`) sobrescreve o valor anterior. Cada chamada adicional apaga a anterior — somente a última ficava ativa. Usar GIT_CONFIG env vars ou arquivo `.gitconfig` com múltiplas linhas `insteadOf`.

---

### Bug 4 — SSL certificate verification failed (`commit 9726655`)
**Sintoma:** Após URL rewrite funcionar, build falha: `server certificate verification failed. CAfile: none CRLfile: none`
**Causa:** `node:22-slim` não inclui CA certificates por padrão.
**Fix:** Adicionar `ca-certificates` ao apt-get install:
```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
        git ca-certificates \
```

---

### Bug 5 — Crash oculto por `set -e` + redirecionamento (`commit 14f9ea1`)
**Sintoma:** Container reinicia em loop. Coolify Logs mostra apenas `[openclaw] Iniciando gateway...` e para. Nenhum erro visível.
**Causa:** `entrypoint.sh` tinha `openclaw gateway >> /tmp/gw.log 2>&1` + `set -e`. Todos os logs do gateway iam para `/tmp/gw.log` (invisível no Coolify). Se o gateway crashasse, `set -e` encerrava o script antes do `cat` imprimir o log.
**Fix:** Usar `exec openclaw gateway` no lugar de redirecionamento:
```bash
exec openclaw gateway
# exec substitui o shell pelo processo do gateway:
# - stdout/stderr vão direto para Docker logs
# - gateway recebe PID 1 (SIGTERM correto do Docker)
```

---

### Bug 6 — controlUi rejeita bind 0.0.0.0 (`commit 64016c5`)
**Sintoma:** Log: `"Gateway failed to start: non-loopback Control UI requires gateway.controlUi.allowedOrigins..."`
**Causa:** openclaw recusa iniciar com bind em endereço não-loopback sem configuração de CORS/origins.
**Fix:** `openclaw.json` → seção gateway:
```json
"gateway": {
  "mode": "local",
  "bind": "custom",
  "customBindHost": "0.0.0.0",
  "port": 18789,
  "controlUi": {
    "dangerouslyAllowHostHeaderOriginFallback": true
  }
}
```

---

### Bug 7 — `gemini-2.0-flash-lite` retorna "Unknown model" (2026-03-02)
**Sintoma:** Log: `FailoverError: Unknown model: gemini/gemini-2.0-flash-lite`. Bot responde "404 No endpoints found for deepseek" (fallback esgotado).
**Causa:** O modelo `gemini/gemini-2.0-flash-lite` não é reconhecido pelo openclaw runtime. O heartbeat usa esse modelo → falha → tenta fallback deepseek com sufixo `:free` (endpoint não disponível no OpenRouter) → 404.
**Fix:**
1. `openclaw.json` → heartbeat model: `gemini/gemini-2.0-flash` (usar primary)
2. `openclaw.json` → fallback: remover sufixo `:free` de `openrouter/deepseek/deepseek-chat`

---

## 3. Como fazer Redeploy correto

### Via git push (automático se configurado)
```bash
git add -A
git commit -m "fix: descrição da mudança"
git push origin main
```
Coolify detecta o push e inicia rebuild automaticamente.

### Via Coolify UI (manual)
1. Acesse `http://72.60.151.145:8000` → openclaw-ai
2. Clique **Redeploy** (botão laranja)
3. Aguarde ~4 min para build completo
4. Verifique **Logs** → deve aparecer `[telegram] starting provider` e `[gateway] listening`

---

## 4. O que verificar nos logs quando algo falhar

### Container não inicia (crash loop)
- Verificar último log antes do restart
- Se vazio: bug de redirecionamento de stdout — checar `entrypoint.sh`
- Se `Gateway start blocked`: falta `mode=local` no `openclaw.json`
- Se `cmake not found`: imagem Alpine em vez de Debian slim

### Bot não responde no Telegram
1. Verificar se `TELEGRAM_OPENCLAW_BOT_TOKEN` está configurada
2. Verificar logs por `[telegram] starting provider` — se ausente, bot não iniciou
3. Verificar se `allowFrom` no `openclaw.json` inclui seu chat_id
4. Verificar se modelos têm API key configurada (`GEMINI_API_KEY`, `OPENROUTER_API_KEY`)

### Erro "Unknown model: xxx"
- O modelo não está disponível via a API key configurada
- Verificar qual API key o modelo usa (gemini → GEMINI_API_KEY, openrouter/* → OPENROUTER_API_KEY)
- Trocar para um modelo conhecido (ex: `gemini/gemini-2.0-flash`)

### Erro "404 No endpoints found for deepseek"
- O fallback deepseek falhou. Causas possíveis:
  1. `OPENROUTER_API_KEY` não configurada
  2. Sufixo `:free` no modelo (remover)
  3. Primary model também falhou antes de chegar no fallback

---

## 5. Estrutura do container

```
/root/.openclaw/
├── openclaw.json        # Config principal (builtin na imagem)
├── entrypoint.sh        # Script de inicialização
├── prompts/             # SOUL.md, IDENTITY.md, USER.md, AGENTS.md, WORKING.md
├── workspace/           # Volume persistente — memória do agente
│   ├── SOUL.md          # Copiado de prompts/ na 1ª execução
│   └── ...
├── memory/              # Volume persistente — memória semântica
└── cron/
    └── jobs.json        # Cron jobs (criado pelo entrypoint se não existir)
```

**Importante:** `workspace/` e `memory/` são volumes persistentes. Reiniciar o container NÃO apaga a memória. Apenas **Delete** do serviço no Coolify (sem "Keep Data") apagaria.

---

## 6. Modelos disponíveis e aliases

| Modelo | Alias | API Key necessária |
|--------|-------|-------------------|
| `gemini/gemini-2.0-flash` | `default` | `GEMINI_API_KEY` |
| `openrouter/deepseek/deepseek-chat` | `brain` | `OPENROUTER_API_KEY` |
| `openrouter/deepseek/deepseek-reasoner` | `subagent` | `OPENROUTER_API_KEY` |
| `openrouter/anthropic/claude-opus-4-6` | `brain-best` | `OPENROUTER_API_KEY` |
| `openrouter/moonshotai/kimi-k2-5` | `brain-savings` | `OPENROUTER_API_KEY` |
| `openrouter/openai/codex-mini-high` | `coding` | `OPENROUTER_API_KEY` |
| `openrouter/perplexity/sonar` | `research` | `OPENROUTER_API_KEY` |
