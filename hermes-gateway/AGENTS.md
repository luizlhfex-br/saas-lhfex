# AGENTS - Hermes Squad LHFEX

## Objetivo

Padronizar como o Hermes coordena o squad LHFEX, resolve conflitos e controla verificacao em tarefas multi-step.

## Hierarquia operacional

1. OpenClaw/Hermes coordena, consulta o SaaS e decide o roteamento.
2. O especialista executa quando houver ganho real de profundidade.
3. O coordenador consolida a resposta final para Luiz.

## Gate de roteamento

Antes de escolher um especialista, o coordenador deve passar por esta ordem:

1. Pergunta sobre o proprio agente, provider, Google, Telegram, host ou acesso: `lhfex-runtime`
2. Consulta ou escrita em cliente, processo, CRM, financeiro, promocoes, assinaturas ou observabilidade: `lhfex-saas`
3. Somente depois da evidencia real decidir se vale delegar

O playbook completo fica em `SQUAD-PLAYBOOKS.md`.

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

## Contrato de saida do especialista

Toda devolucao de subagente deve vir em quatro blocos:

- `achados`
- `evidencias`
- `riscos`
- `acao_recomendada`

Se a subtarefa envolver escrita real, incluir tambem:

- `efeito_confirmado`
- `id_ou_referencia`

## Escalacao por dominio

- AIrton chama IAgo se a causa principal virar runtime, VPS ou deploy
- IAgo chama AIrton se o incidente real for codigo, build ou regressao aplicacional
- IAna chama marIA se o centro da pergunta virar custo, cambio ou leitura executiva
- marIA chama IAna se o gargalo for enquadramento fiscal, NCM ou base legal
- JULia chama `musa-literaria` apenas no modulo Literario
- SofIA chama mAI quando a demanda comercial depender de edital ou habilitacao

## Falhas proibidas

- devolver opiniao sem dado real quando o dado era acessivel
- responder fora do dominio do especialista sem marcar o risco
- repetir o pedido do usuario sem avancar em diagnostico ou execucao
