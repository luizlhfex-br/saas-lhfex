# LHFEX SaaS - Roadmap Atual
> Ultima atualizacao: 2026-03-14 | Versao atual: v2.9.5

---

## Estado Atual

| Modulo | Status | Observacao |
|--------|--------|------------|
| CRM (clientes, contatos, pipeline) | OK | Operacional em producao |
| Processos / Comex | OK | Referencias A/M/C por modal ativas |
| Financeiro corporativo | OK | Faturas, cashflow e relatorios publicados |
| NCM / Classificacao Fiscal | OK | Chain free-first estabilizada |
| IA / Provider Strategy | OK | Vertex -> Qwen Free -> Llama Free -> R1 Free -> DeepSeek Direct |
| OpenClaw multiagente | OK | Deploy automatico e prompts atualizados |
| OpenClaw Telegram | OK | Cliente por CNPJ e processo por cliente + modal ativos |
| Squad Room | OK | `/squad` publicado |
| Assinaturas | OK | CRUD + dashboard BRL/USD publicado |
| Radio Monitor | OK | Campos extras e links publicados |
| Google OAuth + Sheets | Parcial | Fluxo pronto, falta smoke test funcional |
| AI Usage Dashboard | Parcial | Base existe, falta visao consolidada por provider |
| Automacoes backend | Parcial | Infra pronta, painel e jobs ainda podem evoluir |
| Testes | Parcial | Base de CI estabilizada, cobertura ainda pequena |
| Sentry | Pendente | Falta DSN em producao |

---

## Regras Permanentes

1. Single-tenant por design, com isolamento por `companyId` em todas as queries de negocio.
2. Nao usar `openrouter_paid`.
3. Nao retomar metas de multi-tenancy amplo no roadmap atual.
4. Nao registrar segredos em arquivos versionados.
5. Toda release em `main` deve manter `app/config/version.ts`, `app/routes/changelog.tsx` e `UPDATE-LOG.json` sincronizados.

---

## Prioridades Operacionais

### P0 - Smoke tests de producao
- Validar no Telegram:
  - `/cliente 03.954.434/0001-19`
  - `/processo cliente: Empresa ABC, modal: maritimo`
- Validar no SaaS:
  - `/subscriptions`
  - `/squad`
  - Radio Monitor com links de site/WhatsApp
- Validar Google OAuth em `/settings`

### P1 - Observabilidade e seguranca
- Configurar `SENTRY_DSN` no Coolify e validar captura de erro real
- Auditar CSRF nos forms POST mais sensiveis
- Endurecer sessao:
  - expiracao deslizante
  - prefixo `__Host-` quando aplicavel
  - invalidacao limpa no logout
- Limpar warnings operacionais remanescentes do OpenClaw (`safeBinProfiles`)

### P2 - Produto e operacao
- Expandir `/ai-usage` com visao por provider, custo e volume
- Evoluir painel de automacoes backend
- Criar exportacao de relatorio de processo para Google Sheets
- Criar smoke automatizado pos-deploy para SaaS e OpenClaw

### P3 - Qualidade
- Expandir testes unitarios para estrategia de providers e validadores
- Expandir E2E para fluxo completo:
  - login
  - CRM
  - processo
  - dashboard
  - webhook/API do OpenClaw com mock

---

## Env Vars Ainda Relevantes

Sem expor valores no repo, manter conferidos no Coolify/GitHub:

- `SENTRY_DSN`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `GOOGLE_DRIVE_FOLDER_ID`
- `OPENCLAW_TELEGRAM_TOKEN`
- `OPENCLAW_CHAT_ID`
- `OPENCLAW_TOOLS_API_KEY`
- `COOLIFY_API_TOKEN`
- `COOLIFY_BASE_URL`
- `COOLIFY_APP_UUID`
- `COOLIFY_OPENCLAW_APP_UUID`

---

## Backlog Estrategico

### Automacoes nativas
- Alertas diarios e semanais no Telegram
- Resumo operacional automatico
- Fluxos recorrentes sem depender de N8N

### Financeiro
- Integracao mais profunda com Banco Inter
- Importacao de extrato PDF/OFX/CSV
- Conciliacao semi-automatica

### Mobile
- App leve em Expo/React Native
- Consulta de processos e notificacoes push

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
