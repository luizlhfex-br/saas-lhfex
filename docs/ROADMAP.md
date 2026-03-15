# LHFEX SaaS - Roadmap Atual
> Ultima atualizacao: 2026-03-14

---

## Estado Atual

| Modulo | Status | Observacao |
|--------|--------|------------|
| CRM | OK | Clientes, contatos e funil publicados |
| Processos / Comex | OK | Referencias `A/M/C` por modal ativas |
| Financeiro corporativo | OK | Faturas, cashflow e relatorios em producao |
| NCM / Classificacao | OK | Chain principal estabilizada |
| IA / Providers | OK | Vertex -> Qwen Free -> Llama Free -> R1 Free -> DeepSeek Direct |
| OpenClaw multiagente | OK | Deploy automatico e entrypoint endurecido |
| OpenClaw Telegram | OK | Cliente por CNPJ e processo por cliente + modal ativos |
| Squad Room | OK | `/squad` publicado |
| Assinaturas | OK | CRUD e totais BRL/USD publicados |
| Radio Monitor | OK | Campos extras e links publicados |
| Smoke de producao | OK | Login, dashboard, `/squad`, `/subscriptions`, `/personal-life/radio-monitor` e `/settings` validados |
| Google OAuth + Sheets | Parcial | Tela e fluxo base prontos; falta teste funcional com conta real |
| AI Usage Dashboard | Parcial | Base existe; falta visao consolidada por provider/custo |
| Automacoes backend | Parcial | Jobs e painel existem; falta consolidar produto e observabilidade |
| Sentry | Parcial | SDK integrado; falta `SENTRY_DSN` configurado em producao |

---

## Regras Permanentes

1. Single-tenant por design com `companyId` em todas as queries de negocio.
2. Nao usar `openrouter_paid`.
3. Nao retomar metas de multi-tenancy amplo.
4. Nao versionar segredos nem exemplos reais com tokens.
5. Toda release em `main` deve manter `app/config/version.ts`, `app/routes/changelog.tsx` e `UPDATE-LOG.json` sincronizados.

---

## Prioridades Reais

### P0 - Validacao funcional manual
- Testar no Telegram:
  - `/cliente 03.954.434/0001-19`
  - `/processo cliente: Empresa ABC, modal: maritimo`
- Testar Google OAuth completo em `/settings`
- Confirmar no CRM e em Processos se os atalhos do OpenClaw gravam tudo como esperado

### P1 - Observabilidade e seguranca
- Configurar `SENTRY_DSN` no Coolify e validar captura real
- Expandir CSRF para mais rotas de negocio alem de login, logout, settings, CRM novo, processos novos e subscriptions
- Planejar expiracao deslizante de sessao sem espalhar regressao por loaders/actions
- Revisar `gateway.bind` e privacy mode do Telegram no OpenClaw

### P2 - Produto e operacao
- Expandir `/ai-usage` com volume, custo e provider
- Evoluir o painel de automacoes backend
- Criar exportacao de processo para Google Sheets
- Adicionar smoke autenticado pos-deploy quando houver segredo dedicado para isso

### P3 - Qualidade
- Expandir testes unitarios de provider strategy, auth e validadores
- Expandir E2E para fluxos completos de CRM, processo e OpenClaw tools
- Reduzir warnings de build por imports dinamicos misturados

---

## Env Vars Ainda Relevantes

Sem expor valores no repo, manter conferidos no Coolify/GitHub:

- `SENTRY_DSN`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `GOOGLE_DRIVE_FOLDER_ID`
- `OPENCLAW_TOOLS_API_KEY`
- `TELEGRAM_OPENCLAW_BOT_TOKEN`
- `TELEGRAM_LUIZ_CHAT_ID`
- `COOLIFY_API_TOKEN`
- `COOLIFY_BASE_URL`
- `COOLIFY_APP_UUID`
- `COOLIFY_OPENCLAW_APP_UUID`

---

## Backlog Estrategico

### Automacoes nativas
- Alertas operacionais e resumos recorrentes no Telegram
- Mais jobs nativos sem depender de N8N

### Financeiro
- Integracao mais profunda com Banco Inter
- Importacao de extrato PDF/OFX/CSV
- Conciliacao semi-automatica

### Mobile
- App leve para consulta de processos e notificacoes

---

## Como Retomar

```text
Plano mestre: C:\Users\luizf\.claude\plans\noble-toasting-seahorse.md
Repo local: C:\Users\luizf\projects\saas-lhfex
Producao: https://saas.lhfex.com.br
```

```bash
npx tsc --noEmit
npm run build
git status
```
