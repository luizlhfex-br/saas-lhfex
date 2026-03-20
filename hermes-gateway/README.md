# hermes-gateway

Artefatos operacionais para migrar o OpenClaw atual para Hermes Agent sem perder:

- acesso ao SaaS via `/api/openclaw-tools`
- token atual do Telegram
- memoria operacional
- skills da LHFEX
- rollback limpo para o OpenClaw

## O que este diretorio entrega

- `SOUL.md`: prompt principal do Hermes para o contexto LHFEX
- `skills/`: skills no formato oficial `SKILL.md`
- `bootstrap-hermes.sh`: instala/configura Hermes no VPS de forma idempotente
- `sync-context.sh`: sincroniza SOUL e skills do repositorio para `~/.hermes`
- `RUNBOOK.md`: instalacao, cutover e rollback
- `CUTOVER-CHECKLIST.md`: checklist objetivo para a virada

## Decisoes adaptadas ao runtime real do Hermes

- Hermes `v2026.3.17`
- sem provider nativo Vertex no runtime do Hermes
- `fallback_model` unico no `config.yaml`
- subagentes via `delegate_task`, nao via pasta `agents/` como no OpenClaw
- Telegram continua com o mesmo bot token no cutover
- endpoint do SaaS continua `/api/openclaw-tools` com header `X-OpenClaw-Key`
- runtime estabilizado com `deepseek-chat` como primario e `openrouter/minimax/minimax-m2.5:free` como fallback
- skill `lhfex-runtime` dedicada para diagnostico de provider, acesso ao SaaS, host, Telegram e Google

## Ordem recomendada

1. Executar `bootstrap-hermes.sh` no VPS
2. Validar CLI e acesso ao SaaS
3. Instalar gateway do Hermes sem desligar o OpenClaw
4. Fazer cutover so depois do checklist completo
