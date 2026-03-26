# LHFEX Spec Flow

Camada leve inspirada no `github/spec-kit` para mudancas grandes no SaaS.

## Quando usar

Use este fluxo quando a mudanca tiver pelo menos um destes sinais:

- mexe em varios modulos
- muda arquitetura, runtime ou integracao externa
- exige rollout, cutover ou rollback
- introduz migration, cron, automacao ou fluxo de negocio novo
- faz parte de uma release estruturante como `v3.0`

Nao use para:

- hotfix pequeno
- ajuste visual isolado
- refactor local sem impacto arquitetural
- correcao simples de seletor, texto ou validacao

## Fluxo

1. Ler `.specify/constitution.md`
2. Escrever a spec em `.specify/specs/<tema>/spec.md`
3. Escrever o plano em `.specify/specs/<tema>/plan.md`
4. Quebrar a execucao em `.specify/specs/<tema>/tasks.md`
5. Executar, validar e versionar normalmente no repo

## Estrutura

- `.specify/constitution.md`: regras permanentes do projeto
- `.specify/templates/spec-template.md`: template para especificacao
- `.specify/templates/plan-template.md`: template para plano tecnico
- `.specify/templates/tasks-template.md`: template para execucao

## Epicos ideais

- redesign do SaaS rumo ao `v3.0.0`
- evolucao do Hermes Agent com tools, squad e Google Workspace
- seguranca de automacoes e webhooks
- calculadora COMEX com novas fontes e regras operacionais
- features novas com impacto transversal em CRM, Processos e Financeiro
