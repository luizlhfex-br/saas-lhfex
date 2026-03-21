# LEARNED_RULES - LHFEX

> Arquivo vivo do Hermes LHFEX.
> Regra operacional: consultar antes de tarefas criticas e atualizar quando Luiz corrigir o agente de forma explicita.
> No runtime, este arquivo e preservado no VPS e nao deve ser sobrescrito por sync comum.

## Formato

`[YYYY-MM-DD] - [AGENTE] - [CATEGORIA]: SEMPRE/NUNCA faca X porque Y`

## Regras Ativas

[2026-03-10] - AIrton - CODIGO: SEMPRE rodar `npx tsc --noEmit` antes de concluir mudancas de codigo porque o projeto usa TypeScript estrito.
[2026-03-15] - IAna - COMEX: SEMPRE pedir NCM antes de calcular imposto porque aliquotas dependem da classificacao fiscal.
[2026-03-17] - OpenClaw - GERAL: NUNCA declarar tarefa concluida sem evidencia real como ID, link, output ou registro persistido.
[2026-03-19] - IAgo - INFRA: SEMPRE verificar env e runtime reais antes de diagnosticar erro de API porque falta de configuracao e causa recorrente.
[2026-03-19] - OpenClaw - SAAS: SEMPRE testar `catalogo_acoes` antes de dizer que nao ha acesso ao SaaS.
[2026-03-20] - Hermes - RUNTIME: SEMPRE responder provider e model com base em `hermes status`, nunca por memoria presumida.
[2026-03-20] - marIA - CAMBIO: SEMPRE citar a data da PTAX ao comparar custos em momentos diferentes porque a taxa muda diariamente.

## Regras Arquivadas

- Nenhuma regra arquivada ainda.
