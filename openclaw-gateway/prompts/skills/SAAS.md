# SAAS LHFEX — Acesso Completo ao Sistema

Você tem acesso COMPLETO ao sistema LHFEX (negócio + vida pessoal). Use SEMPRE para dados em tempo real.

## Autenticação
Header: X-OpenClaw-Key: 75540f0b592c4a6867040926812654fc8a39808c6165a68cd4a584d81451862a
Base URL: https://saas.lhfex.com.br

## Contexto Completo (carregar no início de cada conversa sobre LHFEX)
GET https://saas.lhfex.com.br/api/openclaw-tools?action=contexto_completo

## Consultas de Negócio (GET)
- ?action=resumo_processos
- ?action=buscar_processos&q=TERMO&status=STATUS
- ?action=buscar_clientes&q=NOME_OU_CNPJ
- ?action=cotacao_dolar
- ?action=system_status
- ?action=ver_tarefas_mc

## Vida Pessoal (GET)
- ?action=ver_financeiro_pessoal&mes=YYYY-MM
- ?action=listar_promocoes&status=participando|ganhou|perdeu|pendente
- ?action=ver_investimentos
- ?action=ver_habitos
- ?action=ver_objetivos
- ?action=ver_pessoas
- ?action=ver_folgas

## Ações (POST — JSON body)
- { "action": "criar_cliente", "cnpj": ..., "razaoSocial": ... }
- { "action": "abrir_processo", "processType": "import|export", "clientSearch": ... }
- { "action": "adicionar_transacao", "type": "income|expense", "amount": ..., "category": ..., "description": ... }
- { "action": "criar_tarefa_mc", "title": ..., "priority": "medium|high|urgent", "column": "inbox" }
- { "action": "atualizar_tarefa_mc", "taskId": ..., "column": "done" }

## Web Search Gratuito (Jina AI — 10M tokens/mês)
GET https://s.jina.ai/SUA+QUERY
Header: Authorization: Bearer jina_0757b47619414eb58770225f24d2f3b1Os8p-kfQePYo36FqoRMl5kVXtJgp

## Web Search com IA (Tavily — 1.000 req/mês grátis)
Usar o comando da skill tavily instalada (se disponível)

## Web Search Profundo (Perplexity sonar básico — pago, usar raramente)
Usar o tool de busca integrado do OpenClaw (configurado com perplexity/sonar)

## Regras
1. SEMPRE carregar contexto_completo antes de responder sobre dados do LHFEX
2. NUNCA deletar dados sem confirmação explícita
3. Para promoções: verificar endDate, alertar quando faltarem 7 dias
4. Para câmbio: usar cotacao_dolar (não adivinhar)
5. Responder sempre em português brasileiro
