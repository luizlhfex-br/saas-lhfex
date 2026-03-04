#!/bin/bash
# claude-daemon.sh — Daemon local que executa tarefas Claude Code pedidas via OpenClaw/Telegram
#
# SETUP (rodar uma vez no terminal local):
#   export OPENCLAW_TOOLS_API_KEY="sua-chave-aqui"
#   export SAAS_URL="https://saas.lhfex.com.br"
#   bash scripts/claude-daemon.sh
#
# O daemon fica em loop, verifica tarefas pendentes a cada 60s,
# executa com `claude --print`, e atualiza o status na API.

set -euo pipefail

POLL_INTERVAL="${POLL_INTERVAL:-60}"
SAAS_URL="${SAAS_URL:-https://saas.lhfex.com.br}"
API_KEY="${OPENCLAW_TOOLS_API_KEY:?'Erro: OPENCLAW_TOOLS_API_KEY não definida. Exporte antes de rodar.'}"
API_BASE="$SAAS_URL/api/openclaw-tools"
HEADER="X-OpenClaw-Key: $API_KEY"

echo "[daemon] Iniciado. Verificando tarefas a cada ${POLL_INTERVAL}s..."
echo "[daemon] API: $API_BASE"

_api_get() {
  curl -sf -H "$HEADER" "$API_BASE?action=$1" 2>/dev/null || echo '{}'
}

_api_post() {
  curl -sf -X POST -H "$HEADER" -H "Content-Type: application/json" \
    -d "$1" "$API_BASE" > /dev/null 2>&1 || true
}

_json_escape() {
  python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))" 2>/dev/null || echo '""'
}

while true; do
  RESPONSE=$(_api_get "listar_tarefas_pendentes")

  # Extrair lista de tarefas (id e prompt)
  TASKS=$(echo "$RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    tasks = data.get('tasks', [])
    for t in tasks[:3]:
        # Escape newlines in prompt for safe shell handling
        prompt = t['prompt'].replace('\n', '\\\\n').replace('|', ' ')
        print(f\"{t['id']}|{prompt}\")
except:
    pass
" 2>/dev/null || true)

  if [ -n "$TASKS" ]; then
    while IFS='|' read -r TASK_ID PROMPT; do
      [ -z "$TASK_ID" ] && continue
      echo "[daemon] $(date '+%H:%M:%S') Executando tarefa $TASK_ID"

      # Marcar como running
      _api_post "{\"action\":\"atualizar_tarefa_claude\",\"id\":\"$TASK_ID\",\"status\":\"running\"}"

      # Restaurar newlines no prompt
      FULL_PROMPT=$(echo "$PROMPT" | sed 's/\\n/\n/g')

      # Executar com Claude Code
      if RESULT=$(claude --print "$FULL_PROMPT" 2>&1); then
        RESULT_JSON=$(echo "$RESULT" | head -50 | _json_escape)
        _api_post "{\"action\":\"atualizar_tarefa_claude\",\"id\":\"$TASK_ID\",\"status\":\"done\",\"result\":$RESULT_JSON}"
        echo "[daemon] ✅ Tarefa $TASK_ID concluída"
      else
        ERR_JSON=$(echo "$RESULT" | head -10 | _json_escape)
        _api_post "{\"action\":\"atualizar_tarefa_claude\",\"id\":\"$TASK_ID\",\"status\":\"error\",\"errorMsg\":$ERR_JSON}"
        echo "[daemon] ❌ Tarefa $TASK_ID falhou"
      fi

    done <<< "$TASKS"
  else
    echo "[daemon] $(date '+%H:%M:%S') Sem tarefas pendentes."
  fi

  sleep "$POLL_INTERVAL"
done
