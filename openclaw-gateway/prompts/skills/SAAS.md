# SAAS LHFEX - Acesso ao Sistema

Use esta skill sempre que precisar de dados reais do SAAS.

## Base
- Base URL: `${SAAS_URL}`
- Header: `X-OpenClaw-Key: ${OPENCLAW_TOOLS_API_KEY}`
- O acesso normal ao SaaS e via API/tools; browser automation so deve ser citado quando realmente necessario e previamente configurado.

## Contexto Completo
- `GET ${SAAS_URL}/api/openclaw-tools?action=contexto_completo`
- Carregue no inicio da sessao quando o assunto for LHFEX
- Para descobrir o catalogo completo em runtime, use `action=catalogo_acoes`

## Consultas de Negocio
- `action=resumo_modulos_saas`
- `action=resumo_processos`
- `action=buscar_processos&q=TERMO&status=STATUS`
- `action=buscar_clientes&q=NOME_OU_CNPJ`
- `action=listar_faturas`
- `action=listar_radios`
- `action=cotacao_dolar`
- `action=system_status`
- `action=ver_tarefas_mc`
- `action=ver_assinaturas`
- `action=google_status`
- `action=google_buscar_drive&q=TERMO`

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
- `{ "action": "atualizar_processo", ... }`
- `{ "action": "google_criar_evento_calendario", ... }`
- `{ "action": "google_criar_planilha", ... }`
- `{ "action": "adicionar_transacao", ... }`
- `{ "action": "ask_agent", "agentId": "airton|iana|maria", "message": "..." }`
- `{ "action": "criar_tarefa_claude", "prompt": "..." }`
- `{ "action": "atualizar_tarefa_claude", "id": "...", "status": "running|done|error" }`

## Atalhos Operacionais
- `criar_cliente` aceita apenas `cnpj` e tenta enriquecer automaticamente razao social, nome fantasia, cidade, UF e contato basico.
- `abrir_processo` aceita `clientSearch` + `modal` (`aereo`, `maritimo`, `outros`). Se `processType` nao vier, o padrao e `import`.
- `atualizar_processo` aceita `reference` e campos como `status`, `notes`, `incoterm`, `totalValue`, `currency`, `hsCode`, `originCountry` e `destinationCountry`.
- Validar `google_status` antes de prometer criacao de evento, planilha ou busca em Drive.
- Quando a API devolver ambiguidade de cliente, use os itens em `details.matches` para responder com uma pergunta curta e objetiva.

## Exemplos
- `GET ${SAAS_URL}/api/openclaw-tools?action=catalogo_acoes`
- `GET ${SAAS_URL}/api/openclaw-tools?action=resumo_modulos_saas`
- `GET ${SAAS_URL}/api/openclaw-tools?action=listar_faturas`
- `GET ${SAAS_URL}/api/openclaw-tools?action=google_status`
- `GET ${SAAS_URL}/api/openclaw-tools?action=google_buscar_drive&q=invoice`
- `{ "action": "criar_cliente", "cnpj": "03.954.434/0001-19" }`
- `{ "action": "abrir_processo", "clientSearch": "Empresa ABC", "modal": "maritimo" }`
- `{ "action": "atualizar_processo", "reference": "M26-001", "status": "em andamento", "notes": "Booking confirmado" }`
- `{ "action": "google_criar_evento_calendario", "title": "Reuniao com cliente", "startDateTime": "2026-03-20T14:00:00-03:00", "endDateTime": "2026-03-20T15:00:00-03:00" }`
- `{ "action": "google_criar_planilha", "title": "Resumo LHFEX", "rows": [["Campo", "Valor"], ["Processos ativos", 5]] }`

## Regras
1. Sempre priorize dados reais do SAAS antes de responder.
2. Nunca invente valores, status ou datas.
3. Nunca delete dados sem autorizacao explicita.
4. Para promocoes, verifique `endDate` antes de responder.
5. Para cambio, use `cotacao_dolar`.
6. Responda em portugues brasileiro.
