# RUNBOOK - Hermes Agent LHFEX

## Objetivo

Migrar o OpenClaw atual para Hermes Agent com:

- mesmo bot do Telegram
- mesmo endpoint de ferramentas do SaaS
- rollback rapido
- sem derrubar o ambiente antes da validacao

## Fatos tecnicos confirmados

### Runtime Hermes validado
- release oficial: `v2026.3.17`
- instalacao confirmada no VPS
- comando de versao: `hermes version`
- comando de migracao confirmado: `hermes claw migrate`

### Diferencas reais em relacao ao plano antigo
- nao ha provider nativo Vertex no runtime do Hermes
- o Hermes usa `fallback_model` unico, nao cadeia longa
- a configuracao de subagentes e por `delegate_task`
- skills usam pasta com `SKILL.md`

## Modelo operacional adotado

### LLM
- primario: DeepSeek direto `deepseek-chat`
- fallback: OpenRouter `minimax/minimax-m2.5:free`
- smart routing: desligado para evitar rate limit e respostas inconsistentes no free tier

### Host
- Hermes roda no proprio VPS
- `terminal.backend: local`
- isso ja entrega acesso full ao host sem backend SSH adicional

### Guardrails
- `approvals.mode: manual`
- comandos normais seguem direto
- comandos destrutivos entram em aprovacao

### Diagnostico operacional
- perguntas sobre provider/modelo devem consultar `hermes status`
- perguntas sobre acesso ao SaaS devem validar `catalogo_acoes`
- perguntas sobre Google devem validar `google_status`
- perguntas sobre host/VPS devem ter evidencia via terminal
- `LEARNED_RULES.md` do runtime e vivo e nao deve ser sobrescrito por sync comum

## Instalacao

1. Criar backup da pasta `.openclaw` do container atual
2. Instalar Hermes em `/root/hermes-agent`
3. Migrar `user-data` do backup OpenClaw
4. Completar `.env` do Hermes com variaveis do container atual
5. Sincronizar `SOUL.md`, `AGENTS.md`, `TRAINING.md`, `LEARNED_RULES.md` e skills da LHFEX
6. Garantir os crons versionados com `ensure-crons.sh`
7. Escrever `config.yaml` compativel com o runtime real
8. Instalar o gateway do Hermes sem fazer cutover

## Comandos principais

### Bootstrap
```bash
bash hermes-gateway/bootstrap-hermes.sh
```

### Sincronizar contexto
```bash
bash hermes-gateway/sync-context.sh
```

### Garantir crons versionados
```bash
bash hermes-gateway/ensure-crons.sh
```

### Validar status
```bash
hermes version
hermes status
hermes claw migrate --dry-run --source /root/openclaw-backup-YYYYMMDD-HHMMSS/.openclaw --preset full
```

### Gateway
```bash
hermes gateway install
hermes gateway status
```

## Cutover

1. Parar o container OpenClaw atual
2. Iniciar `hermes gateway start`
3. Testar DM, grupo e approvals
4. So depois habilitar crons

## Rollback

1. `hermes gateway stop`
2. subir novamente o container antigo do OpenClaw
3. confirmar resposta do bot no Telegram

## Bloqueadores de cutover

- SaaS sem resposta via `/api/openclaw-tools`
- Telegram sem allowlist correta
- provider principal sem autenticar
- fallback sem autenticar
- cron sem destino de entrega
- skill `lhfex-saas` nao sincronizada
- skill `lhfex-runtime` nao sincronizada
- `LEARNED_RULES.md` ausente no runtime
- cron `learned_rules_review` ausente
