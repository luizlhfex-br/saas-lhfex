# Automacoes - Roadmap Atual
> Ultima atualizacao: 2026-03-14

---

## O que existe hoje

### SaaS - `app/lib/cron.server.ts`

Jobs ativos no backend do SaaS:

- `invoice_due_soon`
- `process_eta_approaching`
- `cnpj_enrichment`
- `automation_logs_retention`
- `news_daily_digest`
- `vps_monitor`
- `personal_finance_weekly`
- `deadlines_alert`
- `vps_weekly_report`
- `radio_monitor`

Observacao:
- `bills_alert` e `tasks_reminder` dependem da flag `UNIFIED_DEADLINE_ALERTS`

### OpenClaw - `openclaw-gateway/entrypoint.sh`

Jobs ativos no gateway:

- `openclaw-update-check`
- `vps-daily-status`
- `personal-morning`
- `morning-brief`
- `lhfex-weekly`
- `promotions-checker`

---

## O que ja foi resolvido

- Nao dependemos de N8N para a base de automacoes
- OpenClaw ja tem cron proprio e workspace persistente
- O SaaS ja tem engine de triggers e logs de automacao
- O monitoramento basico de producao ja pode ser validado pelo smoke pos-deploy

---

## Proximo sprint recomendado

### P0 - Consolidar observabilidade
- Exibir falha/sucesso dos jobs principais em um painel unico
- Ligar Sentry no runtime de producao
- Padronizar alerts de cron com menos ruido

### P1 - Produto de automacoes
- Melhorar a UX do painel `/automations`
- Mostrar ultimo run, duracao e erro por job
- Separar melhor automacoes de SaaS e automacoes de OpenClaw

### P2 - Entregas com impacto direto
- Resumo operacional diario mais estruturado
- Relatorio semanal consolidado
- Exportacao de dados para Google Sheets

---

## Fora do escopo agora

- N8N
- backlogs antigos de API de noticias sem dono
- automacoes experimentais sem rota de validacao clara

---

## Regra para novas automacoes

Antes de criar automacao nova, confirmar:

1. qual modulo dono
2. qual trigger real
3. onde loga
4. como alerta falha
5. como testar sem produzir ruido em producao
