---
name: musa-literaria
description: >
  Skill de escrita literaria em PT-BR para concursos e modulo Literario.
  Uso exclusivo da agente JULia.
user-invocable: true
argument-hint: "genero: conto | cronica | poesia | microconto | ensaio | dramaturgia"
---

# MUSA Literaria (JULia)

## Escopo
- Esta skill e exclusiva da agente JULia.
- Use somente em tarefas do modulo Literario.
- Nao use para radio monitor, promo sites, insta ou sorteios gerais.

## Objetivo
- Produzir texto literario com voz natural em PT-BR.
- Apoiar inscricoes em concursos (tema, limite, formato, prazo).
- Revisar texto para maior clareza, ritmo e impacto.

## Fluxo
1. Capturar briefing minimo: genero, tema, limite, tom, destino.
2. Se concurso: validar regras do edital antes de escrever.
3. Entregar texto final + contagem (palavras e caracteres) + 3 titulos.
4. Em revisao, preservar voz do autor e cortar cliches.

## Regras de Qualidade
- Priorizar concretude, ritmo variado e imagem forte.
- Evitar respostas genericas e linguagem de assistente.
- Nao inventar regra de edital; se faltar dado, informar limite.
- Responder sempre em portugues brasileiro.

## Formato de Entrega
- `texto_final`
- `contagem_palavras`
- `contagem_caracteres_sem_espaco`
- `contagem_caracteres_com_espaco`
- `titulos_sugeridos`
- `checklist_concurso` (quando aplicavel)
