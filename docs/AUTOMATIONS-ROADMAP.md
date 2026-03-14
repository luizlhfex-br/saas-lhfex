# 🤖 AUTOMAÇÕES — Roadmap Completo
> LHFEX SaaS + OpenClaw | Backend TypeScript nativo (sem N8N)
> Última atualização: 2026-02-21

---

## 🏗️ Infraestrutura Existente

```
app/lib/cron.server.ts          ← scheduler com setInterval (4 jobs ativos)
app/lib/automation-engine.ts    ← engine com fireTrigger() (5 trigger types, 4 action types)
app/lib/telegram-notifier.ts    ← envio de mensagens Telegram
app/routes/api.telegram-webhook ← bot principal @lhfex_agentes_bot
app/routes/api.openclaw-*       ← bot pessoal @lhfex_openclaw_bot
drizzle/schema/automations.ts   ← tabelas: automations, automationLogs, automationVersionHistory
drizzle/schema/personal-life.ts ← tabelas pessoais (finance, investments, routines, goals, promotions)
```

---

## ✅ AUTOMAÇÕES JÁ ATIVAS

| Nome | Frequência | O que faz |
|------|-----------|-----------|
| `invoice_due_soon` | 4x/dia (9h,12h,15h,18h) | Alerta faturas vencendo em 3 dias |
| `process_eta_approaching` | A cada 6h | Alerta processos com ETA em 48h |
| `cnpj_enrichment` | Domingo 2h | Enriquece novos clientes com dados CNPJ |
| `automation_logs_retention` | A cada 24h | Limpa logs de automação com >90 dias |

---

## 🔴 SPRINT A — Automações Urgentes (implementar agora)

### A.1 📰 Notícias Diárias por Tema (OpenClaw → Telegram)
**Status**: 🔴 A implementar
**Arquivo**: `app/lib/cron.server.ts` + `app/routes/api.news-topics.tsx`

**Como vai funcionar:**
1. Usuário cadastra temas favoritos (`/personal-life/news-topics`)
2. Todo dia às 7h30 → cron busca notícias de cada tema via API
3. IA resume as 3-5 mais relevantes em português
4. Envia via Telegram no @lhfex_openclaw_bot

**API de Notícias:** GNews (gratuita, suporte a PT-BR)
```
GET https://gnews.io/api/v4/search?q={tema}&lang=pt&max=5&apikey={GNEWS_API_KEY}
GET https://gnews.io/api/v4/top-headlines?topic=technology&lang=pt&apikey={GNEWS_API_KEY}
```

**Temas disponíveis no GNews:** breaking-news, world, nation, business, technology, entertainment, sports, science, health

**Tabela nova:** `news_topics` (userId, topic, keywords, active)

**Schema:**
```typescript
export const newsTopics = pgTable("news_topics", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id),
  name: varchar("name", { length: 100 }).notNull(),      // "Tecnologia", "Mercado Financeiro"
  keywords: text("keywords").notNull(),                   // "bitcoin,crypto,web3"
  category: varchar("category", { length: 50 }),         // "technology", "business"
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

**Cron job:** `news_daily_digest` — cron `"0 7 * * *"` (todo dia às 7h)

**Env vars necessárias:**
```
GNEWS_API_KEY=xxx   # ou NEWSAPI_KEY=xxx
```

---

### A.2 🖥️ Monitoramento VPS Hostinger → Telegram
**Status**: 🔴 A implementar
**Arquivo**: `app/lib/cron.server.ts` + `app/routes/api.vps-stats.tsx`

**O que vai monitorar:**
- CPU usage %
- RAM usage %
- Disco usado vs total
- Uptime
- Alertas quando ≥80% em qualquer recurso

**Como funciona:**
- Endpoint público `/api/vps-stats` que retorna métricas do servidor
- Cron `*/30 * * * *` (a cada 30 min) → verifica stats → alerta se ≥80%
- Dashboard em `/automations` mostrando histórico gráfico

**Node.js APIs para coletar métricas:**
```typescript
import os from "node:os";

const stats = {
  cpu: os.loadavg()[0] / os.cpus().length * 100,  // % CPU
  ramTotal: os.totalmem(),
  ramFree: os.freemem(),
  ramUsed: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(1),
  uptime: os.uptime(),  // seconds
  platform: os.platform(),
};
```

**Para disco (Node.js):**
```typescript
import { statfs } from "node:fs/promises";
const disk = await statfs("/");
const diskUsed = (1 - disk.bfree / disk.blocks) * 100;
```

**Mensagem Telegram quando 80%:**
```
🔴 ALERTA VPS HOSTINGER
━━━━━━━━━━━━━━━━
💾 Disco: 81% usado (48GB/60GB)
🧠 RAM: 75% (3.0GB/4GB)
⚡ CPU: 45% (média 5min)
━━━━━━━━━━━━━━━━
💡 Dica: Considere limpar logs antigos
   ou fazer upgrade do plano.
```

**Env vars necessárias:** Nenhuma nova (usa `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` existentes)

---

## 🟡 SPRINT B — Automações Pessoais (OpenClaw)

### B.1 💰 Resumo Financeiro Semanal
**Frequência**: Toda segunda às 8h
**O que envia:**
- Total gasto na semana por categoria
- Comparação com semana anterior
- Saldo disponível estimado
- Top 3 maiores gastos

**Implementação**: Job `weekly_personal_finance` → lê `personalFinance` → IA resume → Telegram

---

### B.2 📈 Relatório de Investimentos (Quinzenal)
**Frequência**: Todo dia 1 e 15 do mês
**O que envia:**
- Portfolio atual com variação %
- Melhor e pior investimento do período
- Recomendação de rebalanceamento (se necessário)

**Implementação**: Job `biweekly_investments` → lê `personalInvestments` → IA analisa → Telegram

---

### B.3 🎯 Check-in de Hábitos Diários
**Frequência**: Todo dia às 21h
**O que envia:**
- Lista de rotinas ativas com pergunta "Concluiu hoje?"
- Após resposta → atualiza `routineTracking`
- Mostra streak atual e recorde

**Implementação**: Job → Telegram com inline buttons → usuário responde → webhook atualiza DB

---

### B.4 🎯 Revisão Semanal de Objetivos
**Frequência**: Toda sexta às 18h
**O que envia:**
- Status dos objetivos `in_progress`
- Progresso atual vs meta
- Ação sugerida para avançar no próximo

**Implementação**: Job `weekly_goals_review` → lê `personalGoals` → IA analisa → Telegram

---

### B.5 🎰 Alertas de Promoções Expirando
**Frequência**: Todo dia às 8h
**O que envia:**
- Promoções que vencem nos próximos 3 dias
- Número da sorte (se houver)
- Link para participar (se disponível)

**Implementação**: Job `promotions_expiring` → lê `promotions` onde endDate ≤ hoje+3 → Telegram

---

### B.6 📅 Briefing Matinal Completo (OpenClaw)
**Frequência**: Todo dia às 7h00 (antes das notícias)
**O que envia:**
- Data e dia da semana
- Previsão do tempo (OpenWeather API)
- 3 tarefas prioritárias do dia
- Lembretes de prazos críticos
- Cotação do dólar

**APIs necessárias:**
```
OPENWEATHER_API_KEY=xxx
GET https://api.openweathermap.org/data/2.5/weather?q=Belo+Horizonte&lang=pt_br&appid={key}
```

---

## 🟢 SPRINT C — Automações Business (LHFEX)

### C.1 📊 Resumo Diário de Negócios
**Frequência**: Todo dia às 8h30
**Bot**: @lhfex_agentes_bot (para admin)
**O que envia:**
- Faturas em aberto e valor total
- Processos ativos por status
- Novos clientes esta semana
- Alerta de faturas vencidas hoje

---

### C.2 💳 Alerta de Fatura Vencida (Melhorado)
**Status**: ✅ Parcialmente ativo (invoice_due_soon)
**Melhoria**: Adicionar envio Telegram além da notificação interna

---

### C.3 🚢 Status de Processos (Automático)
**Frequência**: A cada 12h
**O que envia:**
- Processos com ETA hoje ou amanhã
- Processos sem atualização há +7 dias (alerta de estagnação)
- Processos `pending_approval` aguardando há +2 dias

---

### C.4 📋 Relatório Semanal LHFEX
**Frequência**: Toda segunda às 9h
**O que envia:**
- Receita recebida vs semana anterior
- Novos clientes e processos abertos
- Faturas vencendo esta semana
- Top 3 clientes por faturamento

---

### C.5 🔔 Prospecção via LinkedIn (Futuro)
**Frequência**: Diária
**O que faz:**
- Busca leads por ICP (importer/exporter brasileiro)
- IA gera mensagem personalizada
- Salva no CRM como lead com status "cold_outreach"

---

## 🔵 SPRINT D — Integrações Avançadas

### D.1 📊 Google Sheets Sync Automático
**Frequência**: Toda sexta às 17h
**O que faz:**
- Exporta financeiro pessoal da semana para Google Sheets
- Atualiza planilha de portfolio de investimentos
- Cria aba nova com snapshot do mês

---

### D.2 🌐 Monitor de Câmbio
**Frequência**: A cada 2h (horário comercial)
**O que envia:**
- Alerta se dólar sair da faixa configurada (ex: <5.50 ou >5.80)
- Histórico de variação no dia

**API:** BCB (já integrada no sistema!)

---

### D.3 📰 Clipping de Concorrência/Mercado
**Frequência**: Diária
**O que faz:**
- Monitora notícias sobre: "importação Brasil", "SISCOMEX", "câmbio BRL"
- Resume via IA as mais relevantes para LHFEX
- Envia no bot de negócios

---

### D.4 🏦 Banco Inter API (Quando Token Disponível)
**O que faz:**
- Sync diário de transações
- Match automático com faturas cadastradas
- Alerta quando pagamento é recebido

---

### D.5 📱 Extrato Bancário via OCR
**O que faz:**
- Usuário envia foto/PDF do extrato no Telegram
- IA extrai transações
- Categoriza automaticamente
- Insere em `personalFinance`

**Bot**: @lhfex_openclaw_bot (comando: `/extrato`)

---

## ⚪ SPRINT E — Backlog Futuro

### E.1 Pomodoro via Telegram
- `/pomodoro` → inicia timer 25min
- Bot avisa quando acabar
- Registra sessão de foco em tabela própria

### E.2 Lista de Compras Inteligente
- `/comprar item` → adiciona à lista
- IA agrupa por supermercado/loja
- Notifica quando há promoção de item da lista

### E.3 Monitor de Preços (Amazon/Mercado Livre)
- Cadastra produto + preço-alvo
- Bot monitora diariamente
- Alerta quando preço baixar

### E.4 Agenda Integrada (Google Calendar)
- Lembra de compromissos 1h antes via Telegram
- `/agenda` mostra agenda do dia
- Bloqueia horários de foco automaticamente

### E.5 Rastreamento de Encomendas
- `/rastrear [código]` → consulta Correios/transportadora
- Atualizações automáticas quando status mudar

### E.6 Relatório de Promoção (IA)
- Ao cadastrar promoção, envia PDF regulamento
- IA extrai regras, datas, lojas válidas
- Cria checklist de participação

---

## 📋 Tabela de Prioridades

| ID | Automação | Sprint | Dificuldade | Tempo Est. | Status |
|----|-----------|--------|------------|-----------|--------|
| A.1 | Notícias diárias por tema | A | Médio | 3h | 🔴 Pendente |
| A.2 | Monitor VPS Hostinger | A | Fácil | 1.5h | 🔴 Pendente |
| B.1 | Resumo financeiro semanal | B | Fácil | 1h | 🔴 Pendente |
| B.2 | Relatório de investimentos | B | Fácil | 1h | 🔴 Pendente |
| B.3 | Check-in de hábitos | B | Médio | 2h | 🔴 Pendente |
| B.4 | Revisão semanal de objetivos | B | Fácil | 1h | 🔴 Pendente |
| B.5 | Alertas de promoções expirando | B | Fácil | 1h | 🔴 Pendente |
| B.6 | Briefing matinal completo | B | Médio | 2h | 🔴 Pendente |
| C.1 | Resumo diário de negócios | C | Fácil | 1h | 🔴 Pendente |
| C.2 | Faturas vencidas (Telegram) | C | Fácil | 0.5h | 🔴 Pendente |
| C.3 | Status de processos | C | Fácil | 1h | 🔴 Pendente |
| C.4 | Relatório semanal LHFEX | C | Médio | 2h | 🔴 Pendente |
| D.2 | Monitor de câmbio | D | Fácil | 1h | 🔴 Pendente |
| D.3 | Clipping mercado comex | D | Médio | 2h | 🔴 Pendente |

---

## 🔑 Env Vars Necessárias (Novas)

```bash
# Notícias
GNEWS_API_KEY=xxx            # https://gnews.io (free: 100 req/dia)
# OU
NEWSAPI_KEY=xxx              # https://newsapi.org (free: dev only)

# Previsão do Tempo
OPENWEATHER_API_KEY=xxx      # https://openweathermap.org/api (free: 1000 req/dia)

# Localização para clima
VPS_CITY=Belo+Horizonte      # cidade para previsão do tempo
```

---

## 🏛️ Arquitetura das Automações

```
                    ┌─────────────────────┐
                    │   cron.server.ts    │
                    │   setInterval()     │
                    └──────────┬──────────┘
                               │ chama handlers
              ┌────────────────┼────────────────┐
              ↓                ↓                ↓
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │ fetchNews()  │  │ checkVPS()   │  │ personalSum()│
    │ GNews API    │  │ os.freemem() │  │ DB queries   │
    └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
           │                 │                  │
           ↓                 ↓                  ↓
    ┌────────────────────────────────────────────────┐
    │           askAgent() — IA resume               │
    │   Gemini Free → OpenRouter Free → DeepSeek    │
    └─────────────────────┬──────────────────────────┘
                          │
                          ↓
    ┌────────────────────────────────────────────────┐
    │        sendTelegram() — Bot envia              │
    │   @lhfex_openclaw_bot  @lhfex_agentes_bot     │
    └────────────────────────────────────────────────┘
```
