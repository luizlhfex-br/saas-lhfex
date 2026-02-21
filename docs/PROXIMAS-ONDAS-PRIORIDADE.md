# Próximas Ondas — Ordem de Prioridade Operacional

## Regra aplicada

1. Coisas que o agente faz sozinho e rápido
2. Coisas que o agente faz tudo sozinho
3. Coisas que precisam da sua ação

## Quadro de status das ondas

### ✅ Concluídas
- Onda 6.0 até 6.21 (Sistema de Automações)
- Onda 7.0 — Módulo Compras Públicas
- Onda 8.0 — Módulo Vida Pessoal

### 🔄 Em andamento
- Nenhuma no momento

### ⏭️ Próximas
- Onda 8.1: Integração com agente arIA (sugestões, alertas, análises)
- Onda 9: Banco Inter (integração de pagamentos)
- Onda 10: Relatórios BI (dashboards avançados)

---

## 1) Sozinho e rápido (executadas agora)

- ✅ Remoção de artefatos legados de N8N na raiz do projeto.
- ✅ Script de smoke test de produção: `npm run ops:smoke-prod`.
- ✅ Script de auditoria de variáveis runtime para Coolify: `npm run ops:env-audit`.
- ✅ Organização formal desta priorização em documento único.

Objetivo: reduzir risco operacional imediato e acelerar validação pós-deploy.

---

## 2) Sozinho completo (executadas agora)

- ✅ Pipeline operacional de hardening local:
  - `ops:health-watchdog`
  - `ops:smoke-prod`
  - `ops:env-audit`
- ✅ Healthcheck de container já ativo (Dockerfile).
- ✅ Checklist de hardening Coolify consolidado em `docs/COOLIFY-HARDENING-CHECKLIST.md`.
- ✅ Onda 6 iniciada (automações backend nativas sem N8N):
  - painel de automações + feed de logs em `/automations`
  - gatilho real `new_client` ao cadastrar cliente
  - gatilho real `process_status_change` ao editar status de processo e no fluxo de aprovação
- ✅ Onda 6.1 concluída:
  - endpoint `POST /api/automations-run` para execução manual (teste)
  - log dedicado por execução manual em `automation_logs` (com marcador `_manualRun`)
  - botão de execução manual no painel `/automations`
- ✅ Onda 6.2 concluída:
  - filtro no feed de logs por tipo de execução (`Todos`, `Somente manuais`, `Somente automáticos`)
  - busca textual no feed por automação/status/erro
- ✅ Onda 6.3 concluída:
  - reexecução de automação a partir de log de erro/skip (botão de retry no feed)
  - endpoint manual aceita `logId` para replay com payload base do log
- ✅ Onda 6.4 concluída:
  - rate limit de execuções manuais por usuário (global e por automação)
  - feedback de erro/sucesso de execução manual no painel
- ✅ Onda 6.5 concluída:
  - endpoint dedicado `GET /api/automations-logs` com filtros server-side (`q`, `mode`) e paginação (`page`, `pageSize`)
  - feed `/automations` consumindo histórico paginado do endpoint com navegação `Anterior/Próxima`
  - atualização reativa do feed após execução manual/reexecução
- ✅ Onda 6.6 concluída:
  - filtro por status no histórico (`success`, `error`, `skipped`) com aplicação server-side
  - exportação CSV do histórico filtrado via endpoint dedicado
  - botão `Exportar CSV` no painel `/automations` respeitando filtros ativos
- ✅ Onda 6.7 concluída:
  - endpoint `POST /api/automations-logs-cleanup` para limpeza de logs antigos por retenção em dias
  - confirmação explícita (`LIMPAR LOGS`) antes de excluir
  - trilha de auditoria com quantidade removida, retenção e cutoff
  - controle direto no painel `/automations` para executar limpeza com feedback
- ✅ Onda 6.8 concluída:
  - retenção periódica automática de `automation_logs` via cron
  - política configurável por env (`AUTOMATION_LOG_RETENTION_ENABLED`, `AUTOMATION_LOG_RETENTION_DAYS`, `AUTOMATION_LOG_RETENTION_INTERVAL_HOURS`)
  - auditoria automática da limpeza (`cleanup` em `automation_log`) com quantidade removida e cutoff
- ✅ Onda 6.9 concluída:
  - métricas operacionais no painel de automações (execuções, taxas de sucesso/erro, manuais, intervalo médio)
  - cálculo server-side por período selecionado
- ✅ Onda 6.10 concluída:
  - filtro por período (`24h`, `7d`, `30d`) aplicado em logs, métricas e exportação CSV
  - integração completa do período no endpoint e na UI
- ✅ Onda 6.11 concluída:
  - alerta operacional visual quando taxa de erro fica alta no período
  - ranking das automações com mais erros (Top 5) no painel
- ✅ Onda 6.12 concluída:
  - health dashboard de cron jobs em `/automations/health`
  - última execução por job + status (ativo/aguardando)
  - auto-refresh a cada 30 segundos
- ✅ Onda 6.13 concluída:
  - endpoint `POST /api/automations-simulate` para dry-run de automações
  - retorna outcome esperado sem executar realmente
- ✅ Onda 6.14 concluída:
  - webhook listener interno em `/api/automations-webhook-listener`
  - permite logar eventos de automação vindos de serviços externos
- ✅ Onda 6.15 concluída:
  - endpoint `POST /api/automations-schedule` para agendar execução via cron
  - cron expressions validadas (formato 5 campos)
  - config armazenada em triggerConfig da automação
- ✅ Onda 6.16 concluída:
  - nova tabela `automationVersionHistory` no schema
  - endpoint `GET /api/automations-history?automationId=...` para histórico de mudanças
  - rastreamento de alterações com versão, mudanças, usuário e timestamp
- ✅ Onda 6.17 concluída (preparação):
  - fundação para template builder (estrutura em `automationVersionHistory`)
- ✅ Onda 6.18 concluída:
  - endpoint `POST /api/automations-duplicate` para clonar automação
  - clone começa desativado e recebe novo nome
  - auditoria de clonagem registrada
- ✅ Onda 6.19 concluída:
  - endpoint `POST /api/automations-notify-failure` para notificar falhas
  - suporta múltiplos canais (notification/email/telegram)
  - integração preparada para envio real
- ✅ Onda 6.20 concluída:
  - endpoint `POST /api/automations-test-webhook` para testar webhook
  - retorna statusCode, responseTime, sucesso/erro
  - validação de payload JSON
- ✅ Onda 6.21 concluída:
  - dashboard em `/automations/dashboard` com charts e KPIs
  - trend (últimos 30 dias), distribuição de status, top 10 automações
  - recharts para visualização de dados

Objetivo: deixar monitoramento + validação repetíveis sem depender de intervenção manual sua.

---

## 3) Dependem da sua ação (deixadas para depois)

### Onda 4c (bloqueador funcional)
- [ ] Rodar/confirmar migração interativa no ambiente alvo (`npm run db:push`) quando houver prompt de remoção de colunas.
- [ ] Validar fluxo real OAuth Google com conta final em produção.

### Coolify / produção
- [ ] Garantir variáveis sensíveis como **Runtime Only** no painel Coolify.
- [ ] Confirmar credenciais finais de produção (Redis/Sentry/Telegram, se faltarem).

### Integrações futuras
- [ ] Disponibilizar token Banco Inter quando for iniciar integração.
- [ ] Definir janela para ativar integrações oficiais NCM (Siscomex/TTCE/ComexStat).

---

## Status atual

**Ondas 6.12-6.21 implementadas e prontas para validação operacional.**  
Todos os 10 arquivos recriados, rotas registradas, schema com `automationVersionHistory`. 
Próximo passo: testar criação/edição/disparo de automações reais antes de mover pra Onda 6.99.

---

## ✅ Onda 7 — Módulo Compras Públicas (Lei 14.133/21)

### Status: IMPLEMENTADO ✅ (20/02/2026)

**Objetivo:** Gestão completa de processos de compras públicas com conformidade à Lei 14.133/21.

### Arquivos criados:

**Schema (Drizzle):**
- `drizzle/schema/public-procurement.ts` — 7 tabelas: editais, processos, templates TR, checklists, histórico, alertas

**Rotas de API (4):**
- `api.public-procurement-notices.tsx` — CRUD de editais (create, update, delete com soft-delete)
- `api.public-procurement-processes.tsx` — CRUD de itens/lotes dentro de editais
- `api.public-procurement-alerts.tsx` — Gerenciamento de alertas de prazos críticos
- `api.tr-templates.tsx` — Modelos reutilizáveis de Termo de Referência (TR)

**UI Pages (3):**
- `public-procurement.tsx` — Dashboard com listagem, filtros (status, busca), paginação, estatísticas
- `public-procurement-new.tsx` — Criar novo edital com auto-geração de número (UPA-YYYY-NNN)
- `public-procurement.$noticeId.tsx` — Detalhes completo: edital, itens, checklists, prazos, alertas

**Automações:**
- Trigger `public_procurement_created` — Dispara ao criar novo edital
- Trigger `public_procurement_cancelled` — Dispara ao cancelar edital
- Trigger `procurement_process_created` — Dispara ao adicionar novo item
- Alertas automáticos para prazos críticos (5 dias, 3 dias, 1 dia antes)

**Validação TypeScript:** ✅ Zero errors em todos os 7 arquivos

### Recursos implementados:

✅ **Gestão de Editais:**
- Título, órgão/instituição, modalidade (Licitação Aberta, Pregão, RDC, etc)
- Valor orçado e valor contratado
- Status automático do processo
- Soft-delete para auditoria
- Auto-geração de número de processo (UPA-2026-001 format)

✅ **Gestão de Itens/Processos:**
- Lote e item dentro de edital
- Descrição, quantidade, unidade
- Especificações técnicas
- Integração com NCM codes (opcional)
- Status de negociação (pending, in_negotiation, contracted, delivered)

✅ **Modelos de TR (Termo de Referência):**
- Templates reutilizáveis por categoria (TI, Limpeza, etc)
- Versionamento automático
- Customização por edital
- Tags para busca

✅ **Checklists de Conformidade:**
- Lei 14.133/21 compliance
- Fases: pré-edital, habilitação, julgamento, contratação
- Items com status (done/pending)
- Auditoria de quem completou e quando

✅ **Alertas e Prazos:**
- Alertas por tipo (proposal_deadline, delivery_deadline, budget, contest)
- Severidade (low, medium, high, critical)
- Status automático de alertas (pending, acknowledged, resolved)
- Dashboard de alertas críticos

✅ **Histórico e Auditoria:**
- Todas as mudanças registradas com user + timestamp
- Rastreamento de status changes
- Motivo das alterações

### Próximos passos (quando permitir):

- [ ] Onda 7.1: Integração com agente **IAra** (IA para sugestões de TR, checklists, análise de editais)
- [ ] Onda 7.2: Webhooks para Diário Oficial (integração com publicadores)
- [ ] Onda 7.3: Análise de riscos e conformidade automatizada
- [ ] Onda 7.4: Relatórios de compras por período/modalidade/valor
- [ ] Onda 7.5: Integração com processos de importação/exportação (cruzar com módulo LHFEX core)

---

## ✅ Onda 8 — Módulo Vida Pessoal (20/02/2026 — IMPLEMENTADO ✅)

### Status: IMPLEMENTADO ✅

**Objetivo:** Sistema privado para o Luiz gerir vida pessoal: finanças PF, investimentos, rotinas, objetivos e hobbies.

**Acesso:** 🔐 **RESTRITO a luiz@lhfex.com.br** (via RBAC)

### Arquivos criados:

**Schema (Drizzle):**
- `drizzle/schema/personal-life.ts` — 7 tabelas: finanças pessoais, investimentos, rotinas, rastreamento, promoções, férias, objetivos

**Rotas de API (5):**
- `api.personal-finance.tsx` — CRUD receitas/despesas pessoais com filtro por mês e tipo
- `api.personal-investments.tsx` — CRUD portfolio com cálculo automático de ganho/perda
- `api.personal-routines.tsx` — CRUD rotinas + tracking diário (hábitos)
- `api.promotions.tsx` — CRUD promoções e sorteios (hobby)
- `api.personal-goals.tsx` — CRUD objetivos pessoais com progresso medido

**UI Pages (1 dashboard + 5 módulos):**
- `personal-life.tsx` — Dashboard principal com summary cards e grid de módulos
- *Próximo:* `personal-life.finances.tsx`, `personal-life.investments.tsx`, etc.

**Automações:**
- Trigger `promotion_created` — Dispara ao adicionar promoção
- Trigger `promotion_won` — Dispara ao marcar promoção como ganha
- Alertas automáticos para prazos de promoções

**Validação TypeScript:** ✅ Zero errors em todos os 12 arquivos

### Recursos implementados:

✅ **Finanças Pessoais:**
- Receitas e despesas categorizadas
- Método de pagamento (cash, débito, crédito, PIX)
- Despesas recorrentes
- Cálculo de saldo mensal
- Exportação de histórico

✅ **Investimentos:**
- Suporte a: ações, cripto, poupança, bonds, imóveis
- Rastreamento de quantidade, preço de compra e preço atual
- Cálculo automático de ganho/perda percentual
- Portfolio summary com total investido e valor atual
- Atualização de preço (para integração com APIs futura)

✅ **Rotinas & Hábitos:**
- Tipos: exercício, meditação, leitura, sono, nutrição, aprendizado, hobby
- Frequência: diária, dias úteis, fins de semana, semanal, mensal
- Rastreamento diário com valor (km, páginas, minutos)
- Histórico de 30 dias
- Cálculo de aderência

✅ **Promoções & Sorteios (Hobby):**
- Registrar sorteios, concursos, cashbacks, giveaways
- Status: pending, participated, won, lost
- Armazenar regras, prêmios, links
- Evidência de participação
- Contagem por status
- Alertas de prazos próximos

✅ **Objetivos Pessoais:**
- Categorias: saúde, finanças, aprendizado, hobby, desenvolvimento pessoal
- Tarefas com prazos e prioridades
- Rastreamento de progresso (%)
- Status: em progresso, completado, abandonado
- Timeline visual

✅ **Férias & Planejamento:**
- Tipos: férias, viagem de fim de semana, staycation, retiro
- Orçamento estimado vs. real
- Atividades e acomodação planejadas

### Sistema de Controle de Acesso (RBAC):

Criado arquivo `app/lib/rbac.server.ts` com roles por email:

```typescript
LUIZ (luiz@lhfex.com.br):
- Acesso TOTAL: Comex + Compras Públicas + Vida Pessoal

FINANCEIRO (financeiro@lhfex.com.br):
- Acesso: Apenas módulo Comex (CRM, Processos, Financeiro, etc)

DEFAULT (qualquer outro email):
- Acesso: Apenas módulo Comex (CRM, Processos, Financeiro, etc)
```

✅ **Guards aplicados:**
- Todas as rotas de Compras Públicas: `requireRole(user, [ROLES.LUIZ])`
- Todas as rotas de Vida Pessoal: `requireRole(user, [ROLES.LUIZ])`
- Redirecionamento automático para `/dashboard?error=access_denied` se sem permissão

### Próximos passos (quando permitir):

- [ ] **Onda 8.1:** Integração com agente **arIA** (sugestões, alertas inteligentes, análises)
- [ ] **Onda 8.2:** Dashboard gráfico (investimentos em charts, rotinas em heatmap)
- [ ] **Onda 8.3:** Webhook para atualizar preços de investimentos via API real
- [ ] **Onda 8.4:** Relatórios mensais de finanças PF (net worth, rentabilidade)
- [ ] **Onda 8.5:** Integração com agentes externos (B3 API, Binance API para atualizar preços)

## Próxima execução automática sugerida (quando você mandar)

- **Onda 8.1:** Integração com agente arIA
- **Onda 9:** Banco Inter (integração de pagamentos)
- **Onda 10:** Relatórios BI avançados (dashboard de Comex completo)
