# 🗺️ LHFEX SaaS — Roadmap Completo
> Última atualização: 2026-02-21 | Versão atual: v3.0.0

---

## 📊 Estado Atual dos Módulos

| Módulo | Status | Sprint |
|--------|--------|--------|
| CRM (clientes, contatos, pipeline) | ✅ Completo | — |
| Processos / Comex | ✅ Completo | Sprint 3.4 |
| Financeiro corporativo (faturas, cashflow) | ✅ Completo | — |
| Calculadora Comex (4 modalidades) | ✅ Completo | — |
| NCM / Classificação Fiscal | ✅ Completo | — |
| Agentes IA (AIrton, IAna, marIA, IAgo) | ✅ Completo | — |
| Google OAuth + Sheets export | ⚠️ Aguardando teste | Sprint 1.2 |
| OpenClaw Bot Telegram | 🔴 Corrigindo webhook | Sprint 1.1 |
| Provider Strategy (budget IA) | ✅ Implementado | Sprint 2 |
| Personal Life (finanças, investimentos, rotinas, objetivos) | ✅ CRUD OK | Sprint 2.1 |
| Personal Life / Promoções | ⚠️ Parcial | Sprint 3.3 |
| Compras Públicas | ✅ Completo | — |
| Outros Negócios / Internet | ✅ Completo | — |
| Firefly Accounting (módulo contabilidade) | ✅ Implementado | — |
| AI Usage Dashboard | ⚠️ Parcial | Sprint 3.1 |
| Automações backend | ⚠️ Parcial | Sprint 5.1 |
| Testes (unit + e2e) | 🔴 Mínimo (6 tests) | Sprint 4.1 |
| Sentry (error tracking) | ⚠️ Falta DSN | Config Coolify |

---

## 🔴 SPRINT 1 — Correções Urgentes

### 1.1 OpenClaw Bot — Corrigir webhook URL
- **Status**: 🔴 Webhook apontava para `app.lhfex.com.br` (errado) → corrigido para `saas.lhfex.com.br`
- **Ação restante**: Adicionar env vars no Coolify (OPENCLAW_TELEGRAM_TOKEN + OPENCLAW_CHAT_ID + OPENCLAW_ENABLED)
- **Teste**: Enviar mensagem ao @lhfex_openclaw_bot

### 1.2 Google OAuth — Testar fluxo completo
- **Status**: ⚠️ Código pronto, env vars adicionadas, aguardando teste
- **Ação**: /settings → "Conectar Google" → login → confirmar "Google Conectado ✅"
- **Arquivos**: `app/lib/google.server.ts`, `app/routes/api.google-auth.tsx`, `app/routes/api.google-callback.tsx`

### 1.3 Verificar OpenRouter Paid na provider strategy
- **Status**: ⚠️ `ai-provider-strategy.ts` usa `openrouter_paid` priority 3, mas chama mesma função do free
- **Ação**: Garantir que modelo pago (ex: claude-3-5-sonnet) é usado quando provider=openrouter_paid

---

## 🟡 SPRINT 2 — Validar OpenClaw (após Sprint 1)

### 2.1 Testar memória e contexto
- Enviar "Qual é meu saldo total?" → deve buscar de `personalFinance`
- Enviar "Quais meus investimentos?" → deve trazer portfolio
- Verificar em `aiUsageLogs` que feature="openclaw" está gravando

### 2.2 Validar economia de tokens
- Respostas máximo 3 parágrafos (conforme openclaw-gateway/prompts/TRAINING.md)
- Gemini Free sendo usado primeiro (verificar logs)
- Custo em `aiUsageLogs` dentro do esperado

### 2.3 Testar fallback de providers
- Simular falha do Gemini → confirmar fallback para OpenRouter Free automático

### 2.4 Testar Google Sheets export
- `/financial` → exportar para Google Sheets → planilha aparece na pasta Drive configurada

---

## 🟢 SPRINT 3 — Novas Funcionalidades

### 3.1 Dashboard de Provider Usage (IA) — 3-4h
**O que construir:**
- Expandir `/ai-usage` com aba de providers
- Cards por provider: Gemini / OpenRouter Free / OpenRouter Paid / DeepSeek
- % free vs pago, custo acumulado do mês em USD
- Barra de progresso do budget (ex: "$12 de $50 — 24%")
- Tabela: últimas 50 chamadas com provider, tokens, custo, feature
- Gráfico: linha temporal de custo por dia

**Dados disponíveis:** `aiUsageLogs` + `getProviderUsageDashboard()` em `ai-provider-strategy.ts`

**Arquivos:** `app/routes/ai-usage.tsx` (expandir)

---

### 3.2 Alerta automático de budget 80% — 1h
**O que implementar:**
- Job diário em `app/lib/cron.server.ts` que chama `checkBudgetAlerts()`
- Se 80% atingido → enviar Telegram: "⚠️ OpenRouter Paid em 80% do budget ($40/$50)"

---

### 3.3 Cadastro de Pessoas para Promoções — 2-3h
**Schema novo:** `drizzle/schema/people-registry.ts`
```
id, fullName, cpf, birthDate, phone, email, address, rg, instagram, notes, createdBy
```
**UI:** `/personal-life/people` — CRUD completo com busca e máscara CPF

**Arquivos:**
- `drizzle/schema/people-registry.ts` (novo)
- `app/routes/personal-life.people.tsx` (novo)
- `app/routes.ts` (+1 rota)

---

### 3.4 Relatório de Processo → Google Sheets — 3-4h
**Dependência:** Google OAuth ativo (Sprint 1.2)

**O que criar:** `app/routes/api.process-report-sheets.tsx`
- 5 abas: Dados da Importação | Timeline | Custos | Documentos | Observações
- Botão "📊 Gerar Relatório" em `processes-detail.tsx`

---

## 🔵 SPRINT 4 — Segurança e Qualidade

### 4.1 Expandir cobertura de testes — 4-6h
**Estado atual:** 3 unit + 3 e2e (mínimo para um SaaS deste tamanho)

**Meta — unit tests:**
- `app/lib/ai-provider-strategy.ts` → unit test do `selectNextProvider()`
- `app/lib/google.server.ts` → mock da API Google
- `app/lib/validators.ts` → expandir casos de edge

**Meta — e2e tests:**
- login → criar cliente CRM → criar processo → ver dashboard
- OpenClaw via API mock (simular webhook Telegram)

**Framework:** Vitest + Playwright (já configurados)

---

### 4.2 Verificar CSRF Protection — 2h
- `lib/csrf.server.ts` já existe
- Verificar se está aplicado em todos os forms POST (CRM, Financial, Processos)
- Adicionar onde faltando

---

### 4.3 Session Improvements — 1.5h
- Sliding expiration: 24h + refresh ao usar
- `__Host-` prefix nos cookies
- Invalidar sessão no logout

---

## ⚪ SPRINT 5 — Módulos Futuros (Backlog)

### 5.1 Automações Backend Nativas
- Reescrever `automations.tsx` como painel gerenciável real
- Cron jobs nativos: alerta de fatura vencida (email), resumo diário Telegram
- Sem N8N — tudo TypeScript puro

### 5.2 Banco Inter API
- Sync automático de transações (quando token disponível)
- Matching com faturas + conciliação semi-automática

### 5.3 Importação de Extrato Bancário
- Upload PDF/OFX/CSV → IA classifica → preenche financeiro automaticamente

### 5.4 OpenClaw Relatório Semanal Automático
- Cron toda segunda às 8h → resumo pessoal da semana
- Envia no Telegram: "Economizou R$500, investimentos +2.3%, 7/8 hábitos ✅"

### 5.5 Módulo Financeiro Firefly Style (extensão)
- Contas com dupla entrada (ativo/passivo)
- Orçamentos com barra de progresso
- Transações recorrentes com cron job
- Regras de categorização automática

### 5.6 Apps Mobile (Expo/React Native)
- App simples para Google Play
- Notificações push do OpenClaw
- Consulta de processos em campo

---

## 🔧 Config Coolify — Env Vars Pendentes

Acesse https://app.lhfex.com.br → Applications → saas-lhfex → Environment Variables

| Variável | Status | Valor |
|----------|--------|-------|
| OPENCLAW_TELEGRAM_TOKEN | 🔴 Falta | `8508048559:AAHMb6hFvdZVH5J88wmJP2yD7njI9sPNwBA` |
| OPENCLAW_CHAT_ID | 🔴 Falta | `916838588` |
| OPENCLAW_ENABLED | 🔴 Falta | `true` |
| SENTRY_DSN | ⚠️ Falta | Criar conta em sentry.io → copiar DSN |
| GOOGLE_CLIENT_ID | ✅ Adicionado | — |
| GOOGLE_CLIENT_SECRET | ✅ Adicionado | — |
| GOOGLE_REDIRECT_URI | ✅ Adicionado | `https://saas.lhfex.com.br/api/google-callback` |
| GOOGLE_DRIVE_FOLDER_ID | ✅ Adicionado | — |

---

## 📈 Histórico de Versões

| Versão | Data | Destaques |
|--------|------|-----------|
| v3.0.0 | 2026-02-21 | OpenClaw agent + Provider Strategy com budget control |
| v2.1.0 | 2026-02-21 | Redis cache, CI/CD GitHub Actions, 78 TS erros corrigidos |
| v2.0.0 | 2026-02-20 | Ondas 7-8: Personal Life, Public Procurement, Firefly, Radio Monitor |
| v1.5.0 | 2026-02-17 | Redesign dark theme, Calculadora 4 modalidades, AI Usage Dashboard |
| v1.0.0 | 2026-02-15 | MVP: CRM, Processos, Financeiro, Agentes IA, Telegram Bot |

---

## 🚀 Como Retomar (Para Claude em nova sessão)

```
Ler: C:\Users\luizf\.claude\plans\noble-toasting-seahorse.md
Repo: https://github.com/luizlhfex-br/saas-lhfex
App: https://saas.lhfex.com.br
Admin Coolify: https://app.lhfex.com.br
Local: C:\Users\luizf\projects\saas-lhfex
```

```bash
# Comandos essenciais
npm run build          # sempre testar antes de commit
npm run db:push        # aplicar schema ao banco
git add app drizzle && git commit -m "feat: ..." && git push

# Deploy Coolify
curl -X POST https://app.lhfex.com.br/api/v1/applications/a48occks4csoswg8oks0s8wo/restart \
  -H "Authorization: Bearer 2|kDQG1R60G15gw8mO7yyM4R5jawfMMC8HLEUGie8s66bc5c8c"
```
