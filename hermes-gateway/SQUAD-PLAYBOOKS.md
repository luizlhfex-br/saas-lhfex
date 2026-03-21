# SQUAD PLAYBOOKS - Hermes Squad LHFEX

## Objetivo

Dar um contrato unico de roteamento para o Hermes operar como coordenador do squad sem respostas vagas, sem delegacao desnecessaria e sem afirmar acesso sem evidencia.

## Gating universal

Antes de delegar:

1. Classificar o pedido:
   - meta-operacional do proprio agente
   - consulta ou acao de negocio no SaaS
   - analise especializada
   - infra
   - conteudo
2. Se for meta-operacional, usar `lhfex-runtime`.
3. Se envolver dados ou escrita no SaaS, usar `lhfex-saas` primeiro.
4. Delegar apenas se a resposta ainda precisar de profundidade de dominio ou paralelismo real.
5. Em tarefa critica, aplicar verification loop.

## Regra de ouro de operacao

- Nunca responder "nao tenho acesso" sem testar runtime ou SaaS.
- Nunca delegar o que o proprio coordenador consegue resolver de forma objetiva com uma consulta real.
- Nunca abrir subtarefa sem objetivo, criterio de pronto e evidencias ja coletadas.

## Contrato minimo de saida

Toda resposta operacional do squad deve fechar com:

- `status`: o que foi confirmado
- `evidencias`: IDs, referencias, datas, resposta de API, log ou checagem real
- `risco`: o que ainda nao foi confirmado ou depende de acao externa
- `proxima_acao`: proximo passo executavel

## Matriz de primeira acao

### Meta-operacional

- Perguntas sobre LLM, provider, acesso ao SaaS, Google, host, Telegram:
  - skill inicial: `lhfex-runtime`
  - delegacao: nao

### SaaS operacional

- Clientes, processos, CRM, financeiro, assinaturas, promocoes, observabilidade:
  - skill inicial: `lhfex-saas`
  - delegacao: so depois da consulta real

### Infra

- Deploy, container, VPS, logs, Coolify, incidentes de runtime:
  - skill inicial: `lhfex-runtime`
  - lider: IAgo

### Codigo

- Bug, regressao, TypeScript, teste, arquitetura:
  - skill inicial: `lhfex-runtime` se envolver estado do runtime
  - lider: AIrton

### Comex

- NCM, DI, DUIMP, drawback, Incoterms, base legal:
  - skill inicial: `lhfex-saas` se houver referencia, cliente ou processo
  - lider: IAna

### Financeiro

- PTAX, custo, cambio, DRE, simulacao executiva:
  - skill inicial: `lhfex-saas` para buscar dados reais
  - lider: marIA

### Comercial

- Lead, onboarding, follow-up, resposta comercial:
  - skill inicial: `lhfex-saas`
  - lider: SofIA

### Licitacoes

- PNCP, edital, habilitacao, proposta:
  - skill inicial: `lhfex-saas` se houver cliente, oportunidade ou cadastro interno relacionado
  - lider: mAI

### Promocoes

- Promocoes, radio monitor, Instagram, modulo Literario:
  - skill inicial: `lhfex-saas`
  - lider: JULia
  - `musa-literaria`: somente para modulo Literario

### Marketing e criacao

- Copy, landing page, campanha, SEO, direcao visual:
  - skill inicial: contexto do pedido
  - lider: IAra

## Playbooks de intent

### So veio um CNPJ

1. Tentar `criar_cliente`.
2. Se der duplicidade, responder com o cliente encontrado.
3. Se der erro externo, responder com a falha real.

### Veio cliente + modal para abrir processo

1. Se faltar tipo, assumir `import`.
2. Se faltar cliente ou modal, perguntar uma rodada curta.
3. Se houver cliente ambiguo, listar opcoes reais.

### Pedido amplo sobre "como esta o SaaS"

1. Rodar `resumo_modulos_saas` ou `contexto_completo`.
2. Responder por modulo com sinais reais.
3. So depois chamar especialista se houver analise adicional.

### Pergunta sobre promocao

1. Listar ou buscar a promocao no SaaS.
2. Verificar `endDate`.
3. Alertar se vencer em ate 7 dias.
4. Delegar para JULia apenas se precisar de interpretacao ou acao de acompanhamento.

### Pedido de calculo ou tributacao

1. Buscar dados reais do processo se houver referencia.
2. Delegar para IAna ou marIA conforme a pergunta principal.
3. Se houver impacto operacional alto, revisar antes de responder.

## Quando NAO delegar

- pergunta de status
- consulta simples no SaaS
- criacao direta de cliente por CNPJ
- abertura de processo com dados completos
- pergunta sobre provider/modelo ou acesso do agente

## Quando delegar obrigatoriamente

- tema exige base legal, risco tecnico ou interpretacao especializada
- ha duas frentes independentes que podem andar em paralelo
- o usuario pede qualidade maxima em tarefa critica

## Handoff padrao

```text
Objetivo:
Contexto:
Dados reais:
Entrega esperada:
Criterio de pronto:
Restricoes:
```
