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
