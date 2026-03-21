# Plano Completo de Redesign do SaaS LHFEX

## Objetivo

Elevar o SaaS LHFEX de uma interface funcional para uma interface operacional madura, consistente e mais clara para uso diario em comex, CRM, financeiro e IA.

## Lideranca do trabalho

- Direcao visual e UX: IAra
- Implementacao e seguranca de mudancas compartilhadas: AIrton

## Leitura do estado atual

### Pontos fortes

- o app ja tem um shell visual proprio com variaveis `--app-*`
- existe uma identidade de cor coerente o suficiente para evoluir sem recomecar do zero
- dashboard ja usa Recharts e tem base para visualizacao real
- layout principal ja separa shell, topbar, sidebar e mobile nav

### Gargalos encontrados

- cores de foco e componentes ainda variam entre arquivos
- button, input, modal e dropdown ainda carregam decisoes visuais repetidas e nao unificadas
- dropdown e modal ainda precisavam de reforco de teclado
- dashboard mistura informacao operacional valiosa com hierarquia visual pouco definida
- sidebar e topbar sao funcionais, mas ainda podem ficar mais densos e elegantes
- falta um documento unico de direcao visual do produto

## Principios de design

1. Operacional antes de decorativo.
2. Clareza em 5 segundos para as telas principais.
3. Um sistema de tokens para cor, spacing, sombra, radius e foco.
4. Teclado, contraste e mobile como requisitos, nao extras.
5. Recharts com uso cirurgico, nao enfeite.
6. O visual deve transmitir consultoria de comex premium, nao template generico.

## Direcao visual proposta

### Linguagem

- base slate e indigo, com acentos amber para alertas e decisao
- superficies limpas e densidade media
- cards mais tecnicos que promocionais
- leitura rapida, sem excesso de caixas ornamentais

### Tipografia

- manter Inter como sans operacional
- reservar Fraunces apenas para pontos editoriais ou previews especiais, nao para o miolo do SaaS
- manter escala tipografica curta e objetiva

### Motion

- micro transicoes discretas
- abertura de modal, recolhimento de sidebar e entrada de toasts com 150ms a 250ms
- sempre respeitar `prefers-reduced-motion`

## Arquitetura de redesign

### Camada 1: Fundacao

Arquivos-alvo:

- `app/styles/tokens.css`
- `app/app.css`
- `app/root.tsx`
- `app/components/ui/button.tsx`
- `app/components/ui/input.tsx`
- `app/components/ui/modal.tsx`
- `app/components/ui/dropdown.tsx`

Objetivo:

- centralizar tokens semanticos
- unificar foco e estado interativo
- remover variacao cromatica desnecessaria

Resultado esperado:

- componentes com o mesmo padrao de interacao
- menos manutencao manual de classes

### Camada 2: Shell do produto

Arquivos-alvo:

- `app/components/layout/app-shell.tsx`
- `app/components/layout/sidebar.tsx`
- `app/components/layout/topbar.tsx`
- `app/components/layout/mobile-nav.tsx`

Objetivo:

- fazer o shell parecer um produto premium e nao apenas um menu lateral funcional
- melhorar leitura do colapsado/expandido
- dar mais presenca visual ao contexto da pagina e aos controles globais

Mudancas planejadas:

- sidebar com grupos mais nitidos, estados ativos mais elegantes e header mais forte
- topbar com contexto da pagina, breadcrumbs e area de status mais rica
- mobile nav menos utilitario e mais previsivel

### Camada 3: Dashboard

Arquivo-alvo:

- `app/routes/dashboard.tsx`

Objetivo:

- transformar o dashboard em centro de comando

Estrutura alvo:

1. faixa de KPIs prioritarios
2. linha de charts com receita, caixa e distribuicao
3. lista de alertas e atividade recente
4. bloco operacional do squad e links criticos

Melhorias visuais:

- KPI cards com hierarquia melhor
- charts com menos ruido e paleta consistente
- activity feed com linguagem de operacao real
- melhor equilibrio entre financeiro, processos e IA

### Camada 4: Modulos core

Prioridade:

1. CRM
2. Processos
3. Financeiro
4. Calculadora COMEX
5. IA & Auto
6. Vida Pessoal
7. Settings

Objetivo:

- tornar os modulos centrais mais consistentes entre si
- padronizar tabelas, filtros, cards, modais e formularios

### Camada 5: Data visualization

Objetivo:

- usar charts como linguagem de negocio

Mapa inicial:

- Dashboard: receita, fluxo de caixa, processos por modal, pipeline
- Financeiro: vencimentos, aging, BRL vs USD
- Processos: status, modal, carga por cliente
- IA/Agents: heartbeats, runs, falhas e handoffs

## Roadmap de execucao

### Fase 1

- consolidar tokens
- padronizar foco e interacoes base
- fechar a11y minima em modal e dropdown

### Fase 2

- refinar sidebar, topbar e mobile nav
- revisar estados ativos, hover e colapso

### Fase 3

- redesenhar dashboard
- limpar visual de cards e charts

### Fase 4

- aplicar padrao a CRM, processos e financeiro

### Fase 5

- revisar telas menores, settings e vida pessoal
- polimento final

## Criticos de UX por modulo

### CRM

- filtros mais claros
- cards e tabela com leitura mais comercial
- pipeline com mais contraste entre stages

### Processos

- destaque para referencia, cliente, modal e status
- timeline e custos com hierarquia visual melhor
- calculadora integrada visualmente ao fluxo do processo

### Financeiro

- separar leitura executiva de operacao
- deixar BRL e USD claros
- reforcar vencimentos e aging

### IA & Auto

- parecer sala de controle, nao pagina tecnica espalhada
- melhor separar runtime, memoria, fontes, squad e observabilidade

## Regras de implementacao

- nao fazer big bang
- sempre migrar por camada
- toda mudanca compartilhada precisa de validacao visual e typecheck
- preservar o comportamento funcional existente
- evitar reescrever layout inteiro sem necessidade

## Definition of Done do redesign

- design tokens centralizados
- foco e teclado consistentes
- shell mais forte
- dashboard redesenhado
- modulos core alinhados visualmente
- mobile utilizavel
- nenhum modulo central com identidade visual fora do sistema
