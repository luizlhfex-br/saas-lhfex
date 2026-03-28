---
name: lhfex-saas
description: Acesso operacional ao SaaS LHFEX via /api/openclaw-tools para consultas e acoes reais
version: 1.0.0
metadata:
  hermes:
    tags: [lhfex, saas, crm, processos, financeiro, google]
    related_skills: [lhfex-squad-router]
---

# LHFEX SaaS

## Objetivo

Usar dados reais do SaaS LHFEX antes de responder ou agir.

## Base

- Base URL: `${SAAS_URL}`
- Endpoint: `${SAAS_URL}/api/openclaw-tools`
- Header: `X-OpenClaw-Key: ${OPENCLAW_TOOLS_API_KEY}`

## Regras

1. Sempre priorizar este endpoint antes de responder sobre clientes, processos, assinaturas, promocoes, financeiro ou observabilidade.
2. Nunca inventar acesso ou retorno; se a API falhar, informar a falha real.
3. Para ambiguidade de cliente ou processo, devolver pergunta curta com opcoes reais.
4. Nunca deletar dados sem autorizacao explicita.
5. Responder em PT-BR.
6. Se a chamada resolver o pedido, nao delegar para especialista sem motivo claro.
7. Em escrita real, sempre devolver `success`, `id` ou `reference` quando existirem.
8. Nunca chamar uma escrita de `401` sem capturar o HTTP status e o corpo real da resposta.
9. Para `registrar_heartbeat_agente`, considerar sucesso somente se a resposta trouxer `success=true` e `heartbeatId`.

## Validacao de acesso

- Se Luiz perguntar se o agente consegue acessar o SaaS, primeiro testar `action=catalogo_acoes`.
- Se `catalogo_acoes` responder, informar que o acesso operacional ja esta ativo.
- So dizer que falta configuracao se a checagem de ambiente ou a chamada real falharem.
- Nunca pedir `SAAS_URL` ou `OPENCLAW_TOOLS_API_KEY` sem verificar antes se elas ja estao disponiveis.
- Nunca interpretar segredo mascarado como chave truncada; previews como `75540f...862a` sao esperados quando a ferramenta protege o valor.
- Se `catalogo_acoes` responder `200`, nunca pedir a chave ao Luiz.
- Em sessoes ad hoc ou sandboxes, se env parecer ausente, primeiro rodar `set -a; . /root/.hermes/.env`.
- `system_status` serve para a versao do SaaS e telemetria legado do gateway; nao usar esse retorno como versao do proprio Hermes.

## Consultas principais

- `action=catalogo_acoes`
- `action=contexto_completo`
- `action=resumo_modulos_saas`
- `action=resumo_processos`
- `action=buscar_clientes&q=TERMO`
- `action=buscar_processos&q=TERMO`
- `action=listar_faturas`
- `action=listar_promocoes`
- `action=listar_radios`
- `action=ver_assinaturas`
- `action=ver_financeiro_pessoal&mes=YYYY-MM`
- `action=google_status`
- `action=google_buscar_drive&q=TERMO`
- `action=openclaw_observability`
- `action=system_status`
- `action=cotacao_dolar`

## Acoes principais

- `{ "action": "criar_cliente", "cnpj": "62180992000133" }`
- `{ "action": "abrir_processo", "clientSearch": "LHFEX", "modal": "aereo", "processType": "import" }`
- `{ "action": "atualizar_processo", "reference": "A26-001", "status": "in_progress" }`
- `{ "action": "google_criar_evento_calendario", "title": "...", "startDateTime": "...", "endDateTime": "..." }`
- `{ "action": "google_criar_planilha", "title": "...", "rows": [["Campo", "Valor"]] }`

## Atalhos operacionais

- Se Luiz mandar apenas um CNPJ, tentar `criar_cliente`.
- Se Luiz mandar cliente + modal, tentar `abrir_processo`.
- Se Luiz mandar referencia + ajuste, tentar `atualizar_processo`.
- Para perguntas amplas sobre o negocio, carregar `contexto_completo` no inicio da sessao.
- Para perguntas de acesso e prontidao operacional, validar primeiro `catalogo_acoes` e depois responder com evidencias reais.

## Formato de resposta

- consulta: resumo curto, numeros ou referencias principais e fonte da checagem
- escrita: status, efeito confirmado, id ou referencia, proxima acao
- falha: erro real, impacto e o dado minimo faltante

## Execucao via terminal

Para GET:

```bash
set -a
. /root/.hermes/.env
curl -sS "${SAAS_URL}/api/openclaw-tools?action=catalogo_acoes" \
  -H "X-OpenClaw-Key: ${OPENCLAW_TOOLS_API_KEY}"
```

Para POST:

```bash
set -a
. /root/.hermes/.env
curl -sS -X POST "${SAAS_URL}/api/openclaw-tools" \
  -H "Content-Type: application/json" \
  -H "X-OpenClaw-Key: ${OPENCLAW_TOOLS_API_KEY}" \
  -d '{"action":"criar_cliente","cnpj":"62180992000133"}'
```

## Resultado esperado

- consultas: resposta curta, estavel e pronta para Telegram
- acoes: informar `success`, ID/referencia real e proximo passo
