---
name: lhfex-frontend-design
description: Planejamento, redesign e implementacao de frontend para o SaaS LHFEX com foco em design system, layout, componentes, acessibilidade, motion, charts e experiencia operacional em React Router v7 + Tailwind v4. Use quando a tarefa envolver IAra, redesign visual, dashboard, design tokens, consistencia de UI, WCAG, responsividade, tipografia, navegacao ou refinamento de componentes.
---

# LHFEX Frontend Design

## Objetivo

Transformar pedidos de design frontend em entregas executaveis para o SaaS LHFEX sem cair em UI generica, inconsistente ou desconectada do produto.

## Stack alvo

- React Router v7
- Tailwind CSS v4
- TypeScript estrito
- Lucide React
- Recharts para visualizacao
- Tema atual baseado em variaveis `--app-*`

## Regras de design da LHFEX

1. Preservar identidade visual existente quando ela ja estiver bem estabelecida.
2. Preferir tokens semanticos a cores Tailwind espalhadas em componentes.
3. Unificar foco, borda, radius, sombra e spacing antes de redesenhar telas inteiras.
4. Mobile-first e teclado primeiro: foco visivel, Enter, Space, Esc e Arrow keys quando fizer sentido.
5. Motion deve ser funcional e discreto, nunca ornamental.
6. Dashboard e shell do app devem parecer software operacional, nao landing page.
7. IAra lidera direcao visual; AIrton apoia quando houver impacto tecnico, componente compartilhado ou risco de regressao.

## Fluxo de trabalho

### 1. Ler a tela real

Antes de propor qualquer redesign:

- localizar rota, componentes e layout envolvidos
- identificar tokens, variantes e classes repetidas
- mapear gargalos: inconsistencia, legibilidade, densidade, teclado, mobile, hierarquia

### 2. Classificar o tipo de melhoria

- fundacao: tokens, theme vars, focus, borders, spacing
- shell: sidebar, topbar, mobile nav, page chrome
- tela: dashboard, CRM, processos, financeiro, settings
- componente: button, input, modal, dropdown, table, card
- visualizacao: KPI, chart, feed, empty state

### 3. Entregar em camadas

Executar nesta ordem:

1. fundacao
2. componentes compartilhados
3. shell
4. telas mais usadas
5. polimento visual

## Heuristicas de redesign

### Dashboard

- dar prioridade a hierarquia visual e leitura em 5 segundos
- destacar 3 a 5 KPIs realmente operacionais
- usar charts com sentido de negocio e legenda limpa
- activity feed e alertas devem parecer operacao viva, nao ruido

### Sidebar e navegacao

- reduzir ruido visual
- agrupar por dominio real
- reforcar estados ativos e colapsados
- manter leitura boa tanto expandida quanto recolhida

### Formulario

- labels consistentes
- estados de erro claros
- foco padronizado
- campos densos, mas respiraveis

### Modal e dropdown

- Enter, Space, Esc e Arrow keys quando aplicavel
- foco inicial previsivel
- nao depender so de mouse

## Sistema visual alvo

- cor principal: indigo
- superficies: slate operacional
- contraste alto
- cards com elevacao discreta
- radius medio
- tipografia utilitaria, sem exagero
- icones Lucide

## Charts

Preferir:

- linha para tendencia
- barra para comparacao
- donut apenas para proporcao simples
- sparkline para contexto rapido em KPI

Evitar:

- excesso de cores
- legenda redundante
- chart sem insight de negocio

## Checklist de qualidade

- tela ficou mais clara em desktop e mobile
- foco esta consistente
- teclado nao quebrou
- variaveis visuais foram reaproveitadas
- textos e labels ficaram mais objetivos
- nenhuma melhoria virou regressao funcional

## Saida esperada

Quando a tarefa for de planejamento:

- `diagnostico`
- `direcao_visual`
- `mudancas_por_camada`
- `riscos`
- `proxima_fase`

Quando a tarefa for de implementacao:

- `arquivos_alvo`
- `mudancas_aplicadas`
- `validacao`
- `pendencias`
