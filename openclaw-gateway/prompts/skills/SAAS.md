# SAAS LHFEX - Acesso ao Sistema

Use esta skill sempre que precisar de dados reais do SAAS.

## Base
- Base URL: `${SAAS_URL}`
- Header: `X-OpenClaw-Key: ${OPENCLAW_TOOLS_API_KEY}`

## Contexto Completo
- `GET ${SAAS_URL}/api/openclaw-tools?action=contexto_completo`
- Carregue no inicio da sessao quando o assunto for LHFEX

## Consultas de Negocio
- `action=resumo_processos`
- `action=buscar_processos&q=TERMO&status=STATUS`
- `action=buscar_clientes&q=NOME_OU_CNPJ`
- `action=cotacao_dolar`
- `action=system_status`
- `action=ver_tarefas_mc`
- `action=ver_assinaturas`

## Vida Pessoal
- `action=ver_financeiro_pessoal&mes=YYYY-MM`
- `action=listar_promocoes&status=pendente|participated|won|lost`
- `action=ver_investimentos`
- `action=ver_habitos`
- `action=ver_objetivos`
- `action=ver_pessoas`
- `action=ver_folgas`

## Acoes
- `{ "action": "criar_cliente", ... }`
- `{ "action": "abrir_processo", ... }`
- `{ "action": "adicionar_transacao", ... }`
- `{ "action": "ask_agent", "agentId": "airton|iana|maria", "message": "..." }`
- `{ "action": "criar_tarefa_claude", "prompt": "..." }`
- `{ "action": "atualizar_tarefa_claude", "id": "...", "status": "running|done|error" }`

## Regras
1. Sempre priorize dados reais do SAAS antes de responder.
2. Nunca invente valores, status ou datas.
3. Nunca delete dados sem autorizacao explicita.
4. Para promocoes, verifique `endDate` antes de responder.
5. Para cambio, use `cotacao_dolar`.
6. Responda em portugues brasileiro.
