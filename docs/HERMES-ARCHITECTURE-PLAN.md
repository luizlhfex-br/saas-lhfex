# Hermes Agent Architecture Plan
> Ultima atualizacao: 2026-03-25

## Objetivo

Consolidar o Hermes Agent como runtime oficial de agentes da LHFEX, absorvendo os padroes mais uteis de `awesome-openclaw-agents` sem perder compatibilidade com o SaaS, o Telegram e o endpoint legado `/api/openclaw-tools`.

## Estado atual

- o runtime oficial esta em `hermes-gateway/`
- o SaaS continua expondo as tools por `/api/openclaw-tools`
- o squad ja possui especialistas, playbooks, learned rules e observabilidade
- a UI do SaaS ja mostra skills, heartbeats, runs, handoffs e work items

## Gaps atuais

- a nomenclatura ainda mistura Hermes Agent com OpenClaw em varios pontos
- faltam contratos ainda mais fortes para tarefas multi-step no Telegram
- ainda ha espaco para amadurecer Google Workspace, cron jobs e RAG por dominio
- parte da camada visual do SaaS ainda depende de estruturas legadas para observabilidade

## Principios

- Hermes Agent e o nome oficial do runtime
- o SaaS continua sendo dono das acoes de negocio
- identificadores legados com `openclaw` ficam apenas onde a compatibilidade tecnica exigir
- toda delegacao precisa ter objetivo, contexto, dados reais e criterio de pronto
- toda escrita importante precisa devolver evidencia
- acoes irreversiveis continuam exigindo confirmacao

## Arquitetura alvo

### Coordenador

O Hermes Agent atua como chief of staff:

- recebe o pedido
- consulta o SaaS
- escolhe o especialista certo
- consolida resposta
- registra a trilha operacional

### Especialistas

- AIrton: produto, codigo, testes e arquitetura
- IAna: comex, NCM, DI, DUIMP, Incoterms e compliance
- marIA: custos, cambio, PTAX, DRE e leitura financeira
- IAgo: VPS, Docker, deploy, logs e incidentes
- IAra: marketing, copy, UX e design system
- SofIA: CRM, onboarding, follow-up e atendimento
- mAI: licitacoes, PNCP, edital e checklist
- JULia: promocoes, sorteios, radio e modulo literario

## Camadas

### Runtime

- `hermes-gateway/SOUL.md`
- `hermes-gateway/AGENTS.md`
- `hermes-gateway/SQUAD-PLAYBOOKS.md`
- `hermes-gateway/TRAINING.md`
- `hermes-gateway/LEARNED_RULES.md`
- `hermes-gateway/skills/*`

### SaaS

- `/agents` como centro operacional do squad
- `/api/openclaw-tools` como ponte oficial de negocio
- observabilidade versionada de runs, heartbeats, handoffs e work items

### Compatibilidade

- endpoint legado permanece `/api/openclaw-tools`
- header legado permanece `X-OpenClaw-Key`
- nomes legados de env continuam validos ate migracao tecnica planejada

## Contrato de delegacao

Toda delegacao deve passar:

- objetivo
- contexto atual
- dados reais
- entrega esperada
- criterio de pronto
- restricoes

## Evolucao recomendada

### Fase 1 - Branding e consistencia

- remover branding residual de OpenClaw na UI e docs ativas
- manter identificadores tecnicos legados apenas onde necessario

### Fase 2 - Operacao guiada

- calibrar fluxos de `criar_cliente`, `abrir_processo` e `atualizar_processo`
- reduzir atrito nas respostas de Telegram
- registrar melhor efeito confirmado e IDs

### Fase 3 - Workspace e ferramentas

- fechar Google Workspace OAuth
- ampliar bridge de Drive, Sheets e Calendar
- decidir whitelist final de MCP e CLI

### Fase 4 - Memoria e contexto

- aplicar embeddings e RAG por dominio
- melhorar contexto recuperado para briefings e consultas complexas

### Fase 5 - Produto

- evoluir o painel `/agents`
- ampliar filtros, alertas e historico operacional
- preparar a camada visual que sustenta o futuro `v3.0`

## Criterio de sucesso

- Hermes Agent vira o nome padrao do runtime nas superficies ativas
- o SaaS continua operando sem regressao de compatibilidade
- o squad responde com mais evidencias e menos ambiguidade
- a proxima fase pode focar em capacidade real, nao em nomenclatura ou base arquitetural
