---
name: lhfex-agent-engineering
description: Aplica os 7 principios de engenharia de agentes da LHFEX em tarefas ambiguas, criticas, multi-step e no ciclo de aprendizado continuo
version: 1.0.0
metadata:
  hermes:
    tags: [lhfex, agent-engineering, verification, learned-rules, context]
    related_skills: [lhfex-saas, lhfex-runtime, lhfex-squad-router]
---

# LHFEX Agent Engineering

## Objetivo

Executar tarefas com loop operacional, DoD, verificacao, contexto enxuto e aprendizado continuo.

## Use quando

- o pedido for ambiguo
- a tarefa for critica ou multi-step
- Luiz corrigir o agente explicitamente
- for necessario revisar ou consolidar `LEARNED_RULES.md`
- houver risco de resposta generica ou sem evidencia

## Arquivos-base

- `/root/.hermes/LEARNED_RULES.md`
- `/root/.hermes/AGENTS.md`
- `/root/.hermes/TRAINING.md`

## Loop obrigatorio

1. Observar: ler contexto e criterios.
2. Pensar: checar se faltam dados, risco e agente certo.
3. Agir: executar a menor acao suficiente.
4. Verificar: comparar o resultado com DoD e criterio de pronto.
5. Repetir: no maximo 3 iteracoes antes de escalar.

## Definition of Done

Uma tarefa so esta pronta quando:

- usa dados reais
- cobre o pedido completo
- confirma IDs, links, outputs ou efeitos reais quando houver escrita
- informa claramente qualquer assuncao ou bloqueio
- nao encerra sem evidencia

## Reverse prompting

Perguntar antes de agir quando:

- o pedido for ambiguo
- faltarem dados obrigatorios
- houver risco alto
- for um fluxo novo sem padrao estabelecido

Formato:

```text
Entendi que voce quer [X].
Para fazer isso preciso de:
1. [dado faltante]
2. [escolha necessaria]
Se preferir, posso seguir com [default seguro].
```

## Verification loop

Para tarefas criticas:

1. implementar
2. revisar o resultado final sem se apegar ao primeiro raciocinio
3. corrigir apenas o que falhou

## Aprendizado continuo

Quando Luiz corrigir o agente de forma explicita:

1. abrir `/root/.hermes/LEARNED_RULES.md`
2. adicionar nova regra no formato padrao
3. evitar duplicar regra ja existente
4. usar linguagem operacional curta

## Pruning

- manter apenas contexto necessario
- descartar bruto apos extrair valor
- resumir sessoes antigas
- reiniciar sessao se houver bloom detection
