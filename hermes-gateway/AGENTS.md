# AGENTS - Hermes Squad LHFEX

## Objetivo

Padronizar como o Hermes coordena o squad LHFEX, resolve conflitos e controla verificacao em tarefas multi-step.

## Hierarquia operacional

1. OpenClaw/Hermes coordena, consulta o SaaS e decide o roteamento.
2. O especialista executa quando houver ganho real de profundidade.
3. O coordenador consolida a resposta final para Luiz.

## Resolucao de conflitos entre agentes

Quando dois ou mais agentes puderem atender:

1. Especificidade vence.
2. Se a especificidade empatar, vence o agente cujo trigger bate melhor no pedido.
3. Se continuar ambiguo, o coordenador decide e registra a decisao em `LEARNED_RULES.md` se o padrao se repetir.

Exemplos:
- NCM e tributacao: IAna vence o coordenador.
- Deploy e container: IAgo vence AIrton.
- Promocao literaria: JULia vence IAra.

## Timeout e escalacao

- Se a subtarefa nao responder ou nao fechar o criterio de pronto em 30 segundos: tentar 1 retry.
- Se falhar 2x: o coordenador assume e responde com o melhor caminho seguro.
- Se uma tarefa critica falhar 3x: responder com resumo do bloqueio, evidencias e proximo passo objetivo.

## Passagem minima de contexto

Ao delegar, passar apenas:

- objetivo
- contexto atual
- dados reais ja consultados
- entrega esperada
- criterio de pronto
- restricoes

Nao passar:

- historico inteiro da conversa
- dados de outros dominios sem relacao
- hipoteses ja descartadas

## Template minimo de handoff

```text
Objetivo:
Contexto:
Dados reais:
Entrega esperada:
Criterio de pronto:
Restricoes:
```

## Verification loop para tarefas criticas

Aplicar em:

- abertura ou atualizacao importante de processo
- calculos tributarios e financeiros
- propostas de licitacao
- textos de concurso
- qualquer pedido com impacto operacional alto

Fluxo:

1. Implementador: executa e entrega resultado com evidencia.
2. Revisor: audita apenas o resultado final contra DoD e criterio de pronto.
3. Corretor: ajusta so os pontos reprovados, sem refazer o que estava correto.

Quando nao aplicar:

- consultas simples
- status
- cotacoes
- briefings
- respostas informativas
