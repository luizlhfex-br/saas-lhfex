# Coolify Hardening Checklist (10 min)

## 1) Healthcheck contínuo

- [ ] Em **Application > Healthcheck**, configure:
  - **Path**: `/api/health`
  - **Port**: `3000`
  - **Interval**: `30s`
  - **Timeout**: `5s`
  - **Retries**: `3`
  - **Start period**: `40s`
- [ ] Confirme nos logs que o container fica `healthy` após o deploy.

> O Dockerfile já possui `HEALTHCHECK` nativo apontando para `/api/health`.

## 2) Alerta de restart loop

### Opção rápida (externa)

- [ ] Rodar watchdog contínuo em um host estável (VPS, servidor de automação ou máquina sempre ligada):

```bash
npm run ops:health-watchdog
```

- [ ] Definir variáveis para alerta Telegram:
  - `TELEGRAM_BOT_TOKEN`
  - `TELEGRAM_CHAT_ID`
  - Opcional: `HEALTHCHECK_FAIL_THRESHOLD=3`

O watchdog envia:
- alerta de queda/restart loop provável após falhas consecutivas,
- mensagem de recuperação quando a API volta.

## 3) Variáveis Build vs Runtime no Coolify

### Runtime only (recomendado)

- [ ] `NODE_ENV=production`
- [ ] `DATABASE_URL`
- [ ] `SESSION_SECRET`
- [ ] `ENCRYPTION_KEY`
- [ ] `APP_URL`
- [ ] `SENTRY_DSN`
- [ ] `TELEGRAM_BOT_TOKEN`
- [ ] `TELEGRAM_CHAT_ID`
- [ ] `TELEGRAM_ADMIN_USERS`
- [ ] `TELEGRAM_ALLOWED_USERS`

### Build-time

- [ ] Evitar `NODE_ENV=production` em build-time no Coolify.
- [ ] Se precisar variável em build-time, usar apenas o estritamente necessário para compilar.

## 4) Verificação pós-deploy (2 min)

- [ ] `GET https://saas.lhfex.com.br/api/health` retorna 200 com `"status":"ok"`
- [ ] `GET https://saas.lhfex.com.br/api/telegram-webhook` retorna 200
- [ ] `GET https://saas.lhfex.com.br/api/telegram-webhook?setup=1` retorna `Webhook is already set`

## 5) Comando de fallback imediato

Se houver comportamento de restart após novo deploy:

1. rollback para último commit saudável;
2. confirmar healthcheck verde;
3. rodar watchdog com intervalo curto (`HEALTHCHECK_INTERVAL_SECONDS=10`) por 10 minutos.
