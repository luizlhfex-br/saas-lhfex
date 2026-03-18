# OpenClaw Architecture Plan
> Ultima atualizacao: 2026-03-17

## Objetivo
Absorver no OpenClaw da LHFEX a arquitetura de agentes do repositorio awesome-openclaw-agents sem copiar o projeto inteiro, adaptando o modelo ao SaaS real, ao Telegram e ao OpenClaw Gateway ja publicados.

## Diagnostico atual
- O gateway ja tem:
  - `SOUL.md` raiz
  - `AGENTS.md` raiz
  - 8 agentes especialistas
  - skills locais e tools do SaaS
  - painel basico de agentes no SaaS
- O gap atual:
  - cada agente ainda vive quase so de `IDENTITY.md`
  - falta contrato claro de delegacao
  - falta catalogo versionado dos agentes
  - falta heartbeat por agente
  - falta estado operacional mais persistente por agente
  - falta observabilidade de execucao e handoff

## Arquitetura alvo
Cada agente deve deixar de ser apenas uma persona e passar a ser um pacote operacional com:
- `IDENTITY.md`
- `SOUL.md`
- `AGENTS.md`
- `README.md`
- `HEARTBEAT.md`
- `WORKING.md`

## Principios
- Manter o OpenClaw raiz como chief of staff
- Fortalecer os 8 agentes atuais antes de criar agentes novos
- Toda delegacao deve ser objetiva, com objetivo, contexto, dados reais e criterio de pronto
- Toda resposta deve diferenciar claramente dado consultado de inferencia
- Acao irreversivel continua exigindo confirmacao

## Mapeamento para a LHFEX

### OpenClaw raiz
- papel: orquestrador
- responsabilidade: receber pedido, puxar contexto, escolher agente, consolidar resposta e registrar trilha

### AIrton
- foco: produto, codigo, bugs, refactor, arquitetura e testes
- arquitipos absorvidos:
  - code-reviewer
  - bug-hunter
  - migration-helper
  - release-guardian

### IAna
- foco: comex, NCM, classificacao, DUIMP, DI, Incoterms, compliance
- arquitipos absorvidos:
  - customs-analyst
  - compliance-reviewer
  - tax-domain-specialist

### marIA
- foco: cambio, custos, DRE, fluxo de caixa e leitura financeira
- arquitipos absorvidos:
  - finance-analyst
  - tax-preparer
  - invoice-manager

### IAgo
- foco: infra, deploy, container, observabilidade, incidentes
- arquitipos absorvidos:
  - incident-responder
  - deploy-guardian
  - runbook-writer

### IAra
- foco: marketing, design, copy, SEO, CRO
- arquitipos absorvidos:
  - content-strategist
  - dashboard-builder visual
  - campaign-ops

### SofIA
- foco: CRM, onboarding, atendimento, follow-up
- arquitipos absorvidos:
  - onboarding-guide
  - customer-success
  - retention-operator

### mAI
- foco: PNCP, edital, checklist, licitacoes
- arquitipos absorvidos:
  - procurement-analyst
  - proposal-assistant
  - compliance-checklist

### JULia
- foco: promocoes, sorteios, radios, oportunidades e vigencias
- arquitipos absorvidos:
  - opportunity-tracker
  - alerts-coordinator
  - monitoring-briefing

## Fundacao estrutural

### 1. Catalogo de agentes
Criar `openclaw-gateway/agents.catalog.json` como base unica de:
- nome
- dominio
- responsabilidades
- skills
- tools
- permissoes
- gatilhos
- KPIs
- arquivos do agente

### 2. Estrutura local por agente
Cada pasta em `openclaw-gateway/prompts/agents/<id>/` deve carregar:
- `IDENTITY.md`
- `SOUL.md`
- `AGENTS.md`
- `README.md`
- `HEARTBEAT.md`

### 3. Runtime do gateway
O `entrypoint.sh` deve:
- copiar os arquivos compartilhados do gateway
- sobrescrever com os arquivos especificos do agente quando existirem
- parar de sobrescrever `WORKING.md` a cada restart
- preservar memoria e estado da sessao por agente

## Contrato de delegacao
Toda delegacao entre agentes deve seguir o mesmo shape:
- contexto atual
- objetivo da chamada
- dados reais ja consultados
- decisao ou artefato esperado
- criterio de pronto
- limite de escopo

Formato sugerido:

```md
## Handoff
- Contexto:
- Objetivo:
- Dados reais:
- Entrega esperada:
- Criterio de pronto:
- Risco conhecido:
```

## Observabilidade futura
Evolucao recomendada para o SaaS:
- tabela `agent_runs`
- tabela `agent_handoffs`
- tabela `agent_heartbeats`
- tabela `agent_work_items`

Essas tabelas vao permitir:
- saber quem executou o que
- qual provider respondeu
- quanto tempo levou
- qual agente esta travado
- quais handoffs falharam

## UI futura no SaaS
Evoluir `/agents` para virar um centro de comando com:
- agentes ativos
- skills
- tools
- permissoes
- heartbeat
- ultimas execucoes
- erros recentes
- KPIs por agente
- matriz de delegacao

## Roadmap de implementacao

### Fase 1 - Fundacao de arquivos
- catalogo de agentes
- arquivos `README`, `SOUL`, `AGENTS`, `HEARTBEAT`
- entrypoint sem reset agressivo de `WORKING.md`

### Fase 2 - Semantica operacional
- contratos de delegacao
- definicao de KPIs por agente
- matriz de ferramentas e permissoes
- padrao de handoff no OpenClaw raiz

### Fase 3 - Observabilidade
- tabelas de execucao e heartbeat
- logs de handoff
- visao administrativa no SaaS

### Fase 4 - Automacoes
- briefing matinal
- follow-up CRM
- radar de promocoes
- radar de licitacoes
- resumo financeiro semanal
- incident digest

### Fase 5 - RAG e memoria forte
- embeddings para docs e contexto operacional
- busca semantica por agente
- memoria contextual por dominio

## O que entra agora
- plano mestre versionado no repo
- catalogo estruturado dos 8 agentes
- scaffolding de arquivos por agente
- ajuste do runtime para preservar `WORKING.md`
- catalogo copiado para o workspace do gateway em runtime
- prompts raiz alinhados com contrato de handoff e uso do catalogo
- `WORKING.md` inicial por agente para evitar sessao vazia a cada boot

## Implementado nesta fase
- `docs/OPENCLAW-ARCHITECTURE-PLAN.md`
- `openclaw-gateway/agents.catalog.json`
- `openclaw-gateway/prompts/agents/<id>/{README,SOUL,AGENTS,HEARTBEAT,WORKING}.md`
- `openclaw-gateway/prompts/SOUL.md` com contrato padrao de handoff
- `openclaw-gateway/prompts/AGENTS.md` com pacote operacional por agente
- `openclaw-gateway/entrypoint.sh` preservando estado e expondo o catalogo ao runtime
- `app/routes/agents.tsx` e `app/lib/openclaw-overview.server.ts` lendo o catalogo para a camada visual do SaaS
- `drizzle/schema/openclaw-observability.ts`, `app/lib/openclaw-observability.server.ts`, `app/routes/api.openclaw-tools.tsx` e `app/routes/agents.tsx` com a fundacao de runs, heartbeats, handoffs e work items do OpenClaw
- `agents.catalog.json`, `SOUL.md`, `AGENTS.md` e `/agents` com matriz de permissao, gatilhos, KPIs e playbooks por agente

## O que fica para os proximos ciclos
- enriquecer a visao de observabilidade com historico, filtros e alertas
- ampliar a UI operacional do SaaS com pagina dedicada por agente
- transformar playbooks em cards mais detalhados e filtraveis por dominio
- automacoes por agente
- embeddings e RAG por dominio

## Criterio de sucesso desta fase
- estrutura dos agentes deixa de depender so de `IDENTITY.md`
- o runtime passa a preservar estado operacional
- o repo ganha uma fonte unica de verdade sobre o squad
- a proxima fase pode evoluir UI, logs e automacoes sem reabrir a base arquitetural
