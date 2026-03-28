#!/usr/bin/env bash
set -euo pipefail

HERMES_BIN="${HERMES_BIN:-$HOME/.local/bin/hermes}"
HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
JOBS_FILE="$HERMES_HOME/cron/jobs.json"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    printf 'Comando ausente: %s\n' "$1" >&2
    exit 1
  }
}

get_job_id_by_name() {
  local name="$1"
  if [ ! -f "$JOBS_FILE" ]; then
    return 0
  fi

  python3 - "$JOBS_FILE" "$name" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
name = sys.argv[2]
data = json.loads(path.read_text(encoding="utf-8"))
for job in data.get("jobs", []):
    if job.get("name") == name:
        print(job.get("id", ""))
        break
PY
}

ensure_job() {
  local name="$1"
  local schedule="$2"
  local deliver="$3"
  local prompt="$4"
  shift 4
  local skills=("$@")
  local job_id
  local cmd=()

  job_id="$(get_job_id_by_name "$name")"

  if [ -n "$job_id" ]; then
    cmd=("$HERMES_BIN" cron edit "$job_id" --name "$name" --schedule "$schedule" --deliver "$deliver" --prompt "$prompt")
  else
    cmd=("$HERMES_BIN" cron create "$schedule" "$prompt" --name "$name" --deliver "$deliver")
  fi

  for skill in "${skills[@]}"; do
    if [ -n "$skill" ]; then
      cmd+=(--skill "$skill")
    fi
  done

  "${cmd[@]}" >/dev/null
  printf '[hermes-crons] job ok: %s\n' "$name"
}

main() {
  require_cmd python3
  require_cmd "$HERMES_BIN"

  local heartbeat_prompt
  local learned_rules_prompt

  heartbeat_prompt="$(cat <<'EOF'
Use the lhfex-runtime, lhfex-saas and lhfex-agent-engineering skills. First get the real Hermes version from the local runtime with `hermes version` and the current provider/model with `hermes status`. Then call the SaaS action registrar_heartbeat_agente with agentId hermes, agentName Hermes Agent, status healthy, provider and model from runtime, summary Hermes gateway online no VPS, and include runtime metadata plus the Hermes version. Treat the heartbeat as successful only if the SaaS returns success=true and a heartbeatId. After that, call SaaS system_status only to read the SaaS version. Never use system_status to infer the Hermes version. If any POST fails, report the exact HTTP status and response body instead of guessing 401. Finally, send a short Telegram summary with these lines and nothing else: `Hermes online - HH:MM BRT`, `Hermes: <real_version>`, `SaaS: <saas_version>`, `Heartbeat: ok` or `Heartbeat: falha HTTP <status>`.
EOF
)"

  learned_rules_prompt="$(cat <<'EOF'
Use the lhfex-agent-engineering skill. Review /root/.hermes/LEARNED_RULES.md. Deduplicate active rules, keep the format consistent, and only move rules to the archived section when they are duplicated or clearly obsolete. Then send a short Telegram summary with active rules, archived rules, and any trend noticed. If nothing relevant changed, send only: LEARNED_RULES revisado: sem mudancas relevantes.
EOF
)"

  ensure_job "hermes_heartbeat" "0 9,15,21 * * *" "telegram" "$heartbeat_prompt" "lhfex-saas" "lhfex-agent-engineering"
  ensure_job "learned_rules_review" "0 18 * * 5" "telegram" "$learned_rules_prompt" "lhfex-agent-engineering"
}

main "$@"
