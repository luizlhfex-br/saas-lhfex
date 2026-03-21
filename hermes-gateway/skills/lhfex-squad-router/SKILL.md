---
name: lhfex-squad-router
description: Orquestra o squad LHFEX no Hermes com delegate_task e handoff objetivo por especialista
version: 1.0.0
metadata:
  hermes:
    tags: [lhfex, squad, delegation, multi-agent]
    related_skills: [lhfex-saas, lhfex-comex-expert, lhfex-licitacoes, lhfex-promocoes, musa-literaria]
---

# LHFEX Squad Router

## Objetivo

Usar `delegate_task` de forma disciplinada para ganhar profundidade sem perder controle operacional.

## Quando delegar

Delegar quando houver:

- necessidade de analise tecnica profunda
- pesquisa paralela em frentes diferentes
- diagnostico de incidente com multiplas hipoteses
- trabalho especializado que nao deve contaminar o contexto principal

Nao delegar quando:

- a acao for direta no SaaS e puder ser resolvida pelo agente principal
- o problema for simples, curto e objetivo
- faltar contexto minimo para o especialista trabalhar

## Regras de handoff

Toda delegacao deve carregar:

- objetivo
- contexto atual
- dados reais ja coletados
- saida esperada
- criterio de pronto
- restricoes

## Resolucao de conflitos

- agente mais especifico vence
- se houver empate, vence o melhor trigger match
- se ainda ficar ambiguo, o coordenador decide e registra a regra em `LEARNED_RULES.md` se o padrao se repetir

## Timeout e escalacao

- se a subtarefa falhar ou demorar demais, tentar 1 retry
- se falhar 2x, o coordenador assume
- se a tarefa critica falhar 3x, responder com bloqueio, risco e proximo passo

## Contexto minimo

Ao delegar, passar apenas o minimo util:

- objetivo
- contexto atual
- dados reais
- entrega esperada
- criterio de pronto
- restricoes

Nao passar historico inteiro se ele nao ajudar o especialista.

## Template de delegacao

```text
Objetivo:
Contexto:
Dados reais:
Entrega esperada:
Criterio de pronto:
Restricoes:
```

## Toolsets padrao para subtarefas

- `terminal,file,web,browser,skills,todo`

## Especialistas

- `references/airton.md`
- `references/iana.md`
- `references/maria.md`
- `references/iago.md`
- `references/iara.md`
- `references/sofia.md`
- `references/mai.md`
- `references/julia.md`

## Heuristica de roteamento

- Codigo, testes, incidentes de software: AIrton
- Comex, NCM, tributacao, DI, DUIMP: IAna
- Custos, PTAX, caixa, DRE: marIA
- VPS, Docker, deploy, Coolify, logs: IAgo
- Marketing, copy, design, SEO, campanhas: IAra
- CRM, follow-up, onboarding, atendimento: SofIA
- PNCP, edital, habilitacao, proposta tecnica: mAI
- Promocoes, radios, Instagram e modulo Literario: JULia

## Notas importantes

- Para promocoes literarias, JULia pode usar `musa-literaria`.
- Para tarefas do SaaS, o especialista deve usar primeiro `lhfex-saas`.
- O resumo final do subagente deve voltar com: achados, risco, acao recomendada e evidencias.

## Verification loop para tarefas criticas

Em tarefas criticas, aplicar:

1. especialista implementa
2. coordenador revisa o resultado final
3. especialista corrige apenas os pontos reprovados
