---
name: lhfex-squad-router
description: Orquestra o squad LHFEX no Hermes com delegate_task, gating de primeira acao e handoff objetivo por especialista
version: 1.1.0
metadata:
  hermes:
    tags: [lhfex, squad, delegation, multi-agent]
    related_skills: [lhfex-saas, lhfex-comex-expert, lhfex-licitacoes, lhfex-promocoes, lhfex-frontend-design, musa-literaria]
---

# LHFEX Squad Router

## Objetivo

Usar `delegate_task` de forma disciplinada para ganhar profundidade sem perder controle operacional.

## Gate obrigatorio antes da delegacao

1. Se a pergunta for sobre o proprio agente, usar `lhfex-runtime`.
2. Se envolver negocio da LHFEX, consultar `lhfex-saas` antes.
3. Delegar apenas quando a resposta ainda exigir dominio profundo, interpretacao tecnica ou paralelismo real.

Se qualquer um desses passos resolver a demanda, nao delegar.

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

## Matriz rapida de roteamento

- Meta-operacional do agente: nao delegar; usar `lhfex-runtime`
- Clientes, processos, CRM, financeiro, promocoes, observabilidade: `lhfex-saas` primeiro
- Codigo, bug, testes, arquitetura: AIrton
- Comex, NCM, DI, DUIMP, drawback, Incoterms: IAna
- Custos, cambio, PTAX, leitura executiva: marIA
- VPS, Docker, logs, deploy, runtime: IAgo
- Marketing, copy, design, redesign frontend, UX, SEO: IAra
- CRM, follow-up, onboarding, mensagem comercial: SofIA
- PNCP, edital, habilitacao, proposta tecnica: mAI
- Promocoes, radios, Instagram, literario: JULia

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
- Marketing, copy, design, redesign do SaaS, UX, SEO, campanhas: IAra
- CRM, follow-up, onboarding, atendimento: SofIA
- PNCP, edital, habilitacao, proposta tecnica: mAI
- Promocoes, radios, Instagram e modulo Literario: JULia

## Playbooks diretos

- So chegou um CNPJ: nao delegar; usar `lhfex-saas` e tentar `criar_cliente`
- Chegou cliente + modal: nao delegar; usar `lhfex-saas` e tentar `abrir_processo`
- Pergunta "quais processos/clientes/assinaturas eu tenho?": nao delegar; usar `lhfex-saas`
- Pergunta sobre provider, Google, host ou acesso ao SaaS: nao delegar; usar `lhfex-runtime`
- Promocao literaria: JULia lidera e pode usar `musa-literaria`

## Notas importantes

- Para promocoes literarias, JULia pode usar `musa-literaria`.
- Para tarefas do SaaS, o especialista deve usar primeiro `lhfex-saas`.
- O resumo final do subagente deve voltar com: achados, risco, acao recomendada e evidencias.
- O coordenador deve responder o consolidado final em `status`, `evidencias`, `risco` e `proxima_acao`.

## Verification loop para tarefas criticas

Em tarefas criticas, aplicar:

1. especialista implementa
2. coordenador revisa o resultado final
3. especialista corrige apenas os pontos reprovados
