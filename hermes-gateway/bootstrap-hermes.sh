#!/usr/bin/env bash
set -euo pipefail

HERMES_VERSION="${HERMES_VERSION:-v2026.3.17}"
HERMES_DIR="${HERMES_DIR:-/root/hermes-agent}"
HERMES_HOME="${HERMES_HOME:-/root/.hermes}"
OPENCLAW_BACKUP_SOURCE="${OPENCLAW_BACKUP_SOURCE:-/root/openclaw-backup-20260319-232906/.openclaw}"
OPENCLAW_CONTAINER_HINT="${OPENCLAW_CONTAINER_HINT:-nw8cc8s8c8kkcgkggocccgw4}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log() {
  printf '[hermes-bootstrap] %s\n' "$*"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    printf 'Comando ausente: %s\n' "$1" >&2
    exit 1
  }
}

install_uv() {
  if command -v uv >/dev/null 2>&1; then
    return
  fi

  if [ -x "$HOME/.local/bin/uv" ]; then
    export PATH="$HOME/.local/bin:$PATH"
    return
  fi

  log "Instalando uv"
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
}

install_hermes() {
  install_uv
  export PATH="$HOME/.local/bin:$PATH"

  if [ ! -d "$HERMES_DIR" ]; then
    log "Clonando Hermes Agent em $HERMES_DIR"
    git clone --branch "$HERMES_VERSION" --depth 1 https://github.com/NousResearch/hermes-agent.git "$HERMES_DIR"
  fi

  cd "$HERMES_DIR"
  git fetch --tags origin
  git checkout "$HERMES_VERSION"
  git submodule update --init --recursive

  uv python install 3.11
  rm -rf venv
  uv venv venv --python 3.11
  export VIRTUAL_ENV="$HERMES_DIR/venv"
  uv pip install -e ".[all]" || uv pip install -e "."

  if [ -d mini-swe-agent ] && [ -f mini-swe-agent/pyproject.toml ]; then
    uv pip install -e ./mini-swe-agent || true
  fi

  if [ -d tinker-atropos ] && [ -f tinker-atropos/pyproject.toml ]; then
    uv pip install -e ./tinker-atropos || true
  fi

  mkdir -p "$HOME/.local/bin"
  ln -sf "$HERMES_DIR/venv/bin/hermes" "$HOME/.local/bin/hermes"
  require_cmd hermes
}

extract_openclaw_env() {
  local container_name
  container_name="$(docker ps --format '{{.Names}}' | grep "$OPENCLAW_CONTAINER_HINT" | head -n 1 || true)"
  if [ -z "$container_name" ]; then
    return 0
  fi

  docker inspect "$container_name" --format '{{range .Config.Env}}{{println .}}{{end}}'
}

ensure_migration() {
  mkdir -p "$HERMES_HOME"

  if [ -d "$OPENCLAW_BACKUP_SOURCE" ]; then
    log "Migrando user-data do backup OpenClaw"
    hermes claw migrate \
      --source "$OPENCLAW_BACKUP_SOURCE" \
      --preset user-data \
      --overwrite \
      --skill-conflict rename \
      --yes >/dev/null || true
  fi
}

write_env_file() {
  local env_dump
  env_dump="$(extract_openclaw_env || true)"

  local telegram_bot_token=""
  local openrouter_api_key=""
  local deepseek_api_key=""
  local openclaw_tools_api_key=""
  local saas_url=""
  local telegram_luiz_chat_id=""
  local groq_api_key=""

  while IFS='=' read -r key value; do
    case "$key" in
      TELEGRAM_OPENCLAW_BOT_TOKEN) telegram_bot_token="$value" ;;
      OPENROUTER_API_KEY) openrouter_api_key="$value" ;;
      DEEPSEEK_API_KEY) deepseek_api_key="$value" ;;
      OPENCLAW_TOOLS_API_KEY) openclaw_tools_api_key="$value" ;;
      SAAS_URL) saas_url="$value" ;;
      TELEGRAM_LUIZ_CHAT_ID) telegram_luiz_chat_id="$value" ;;
      GROQ_API_KEY) groq_api_key="$value" ;;
    esac
  done <<EOF
$env_dump
EOF

  local allow_users=""
  local first_group=""
  if [ -f "$OPENCLAW_BACKUP_SOURCE/openclaw.json" ]; then
    local parsed
    parsed="$(python3 - "$OPENCLAW_BACKUP_SOURCE/openclaw.json" <<'PY'
import json
import sys

path = sys.argv[1]
with open(path, "r", encoding="utf-8") as f:
    data = json.load(f)

telegram = (((data or {}).get("channels") or {}).get("telegram") or {})
allow_from = telegram.get("allowFrom") or []
groups = telegram.get("groups") or {}
group_keys = list(groups.keys())
print(",".join(str(x) for x in allow_from))
print(group_keys[0] if group_keys else "")
PY
)"
    allow_users="$(printf '%s' "$parsed" | sed -n '1p')"
    first_group="$(printf '%s' "$parsed" | sed -n '2p')"
  fi

  export TELEGRAM_BOT_TOKEN_VALUE="$telegram_bot_token"
  export OPENROUTER_API_KEY_VALUE="$openrouter_api_key"
  export DEEPSEEK_API_KEY_VALUE="$deepseek_api_key"
  export OPENCLAW_TOOLS_API_KEY_VALUE="$openclaw_tools_api_key"
  export SAAS_URL_VALUE="$saas_url"
  export TELEGRAM_ALLOWED_USERS_VALUE="$allow_users"
  export TELEGRAM_HOME_CHANNEL_VALUE="${telegram_luiz_chat_id:-$first_group}"
  export GROQ_API_KEY_VALUE="$groq_api_key"

  python3 - "$HERMES_HOME/.env" <<'PY'
import os
import sys

path = sys.argv[1]
items = {
    "OPENROUTER_API_KEY": os.environ.get("OPENROUTER_API_KEY_VALUE", "").strip(),
    "DEEPSEEK_API_KEY": os.environ.get("DEEPSEEK_API_KEY_VALUE", "").strip(),
    "TELEGRAM_BOT_TOKEN": os.environ.get("TELEGRAM_BOT_TOKEN_VALUE", "").strip(),
    "TELEGRAM_ALLOWED_USERS": os.environ.get("TELEGRAM_ALLOWED_USERS_VALUE", "").strip(),
    "TELEGRAM_HOME_CHANNEL": os.environ.get("TELEGRAM_HOME_CHANNEL_VALUE", "").strip(),
    "SAAS_URL": os.environ.get("SAAS_URL_VALUE", "").strip(),
    "OPENCLAW_TOOLS_API_KEY": os.environ.get("OPENCLAW_TOOLS_API_KEY_VALUE", "").strip(),
    "GROQ_API_KEY": os.environ.get("GROQ_API_KEY_VALUE", "").strip(),
}

with open(path, "w", encoding="utf-8") as f:
    for key, value in items.items():
        if value:
            f.write(f"{key}={value}\n")
PY
}

write_config_file() {
  cat > "$HERMES_HOME/config.yaml" <<'EOF'
model:
  provider: deepseek
  default: deepseek-chat
toolsets:
  - hermes-cli
agent:
  max_turns: 90
terminal:
  backend: local
  cwd: /root
  timeout: 180
  docker_image: nikolaik/python-nodejs:python3.11-nodejs20
  singularity_image: docker://nikolaik/python-nodejs:python3.11-nodejs20
  modal_image: nikolaik/python-nodejs:python3.11-nodejs20
  daytona_image: nikolaik/python-nodejs:python3.11-nodejs20
  container_cpu: 1
  container_memory: 5120
  container_disk: 51200
  container_persistent: true
  docker_volumes: []
  docker_mount_cwd_to_workspace: false
  persistent_shell: true
browser:
  inactivity_timeout: 120
  record_sessions: false
checkpoints:
  enabled: true
  max_snapshots: 50
compression:
  enabled: true
  threshold: 0.5
  summary_model: google/gemini-3-flash-preview
  summary_provider: auto
smart_model_routing:
  enabled: false
  max_simple_chars: 180
  max_simple_words: 32
  cheap_model: {}
fallback_model:
  provider: openrouter
  model: minimax/minimax-m2.5:free
auxiliary:
  vision:
    provider: auto
    model: ""
    base_url: ""
    api_key: ""
  web_extract:
    provider: auto
    model: ""
    base_url: ""
    api_key: ""
  compression:
    provider: auto
    model: ""
    base_url: ""
    api_key: ""
  session_search:
    provider: auto
    model: ""
    base_url: ""
    api_key: ""
  skills_hub:
    provider: auto
    model: ""
    base_url: ""
    api_key: ""
  approval:
    provider: auto
    model: ""
    base_url: ""
    api_key: ""
  mcp:
    provider: auto
    model: ""
    base_url: ""
    api_key: ""
  flush_memories:
    provider: auto
    model: ""
    base_url: ""
    api_key: ""
display:
  compact: false
  personality: default
  resume_display: full
  bell_on_complete: false
  show_reasoning: false
  streaming: false
  show_cost: false
  skin: default
privacy:
  redact_pii: false
memory:
  memory_enabled: true
  user_profile_enabled: true
  memory_char_limit: 2200
  user_char_limit: 1375
delegation:
  max_iterations: 50
  default_toolsets:
    - terminal
    - file
    - web
    - browser
    - skills
    - todo
  provider: deepseek
  model: deepseek-chat
timezone: America/Sao_Paulo
approvals:
  mode: manual
command_allowlist: []
security:
  redact_secrets: true
  tirith_enabled: true
  tirith_path: tirith
  tirith_timeout: 5
  tirith_fail_open: true
_config_version: 8
EOF
}

sync_context() {
  log "Sincronizando SOUL e skills locais"
  mkdir -p "$HERMES_HOME/skills"
  cp "$SCRIPT_DIR/SOUL.md" "$HERMES_HOME/SOUL.md"
  cp "$SCRIPT_DIR/AGENTS.md" "$HERMES_HOME/AGENTS.md"
  cp "$SCRIPT_DIR/SQUAD-PLAYBOOKS.md" "$HERMES_HOME/SQUAD-PLAYBOOKS.md"
  cp "$SCRIPT_DIR/TRAINING.md" "$HERMES_HOME/TRAINING.md"
  if [ ! -f "$HERMES_HOME/LEARNED_RULES.md" ]; then
    cp "$SCRIPT_DIR/LEARNED_RULES.md" "$HERMES_HOME/LEARNED_RULES.md"
  fi
  rm -rf "$HERMES_HOME/skills/lhfex-saas" \
         "$HERMES_HOME/skills/lhfex-agent-engineering" \
         "$HERMES_HOME/skills/lhfex-runtime" \
         "$HERMES_HOME/skills/lhfex-squad-router" \
         "$HERMES_HOME/skills/lhfex-comex-expert" \
         "$HERMES_HOME/skills/lhfex-licitacoes" \
         "$HERMES_HOME/skills/lhfex-promocoes" \
         "$HERMES_HOME/skills/musa-literaria"
  cp -R "$SCRIPT_DIR/skills/"* "$HERMES_HOME/skills/"
}

install_gateway_service() {
  loginctl enable-linger root >/dev/null 2>&1 || true

  if [ ! -f "$HOME/.config/systemd/user/hermes-gateway.service" ]; then
    hermes gateway install --force >/dev/null || true
  fi
}

ensure_crons() {
  if [ -f "$SCRIPT_DIR/ensure-crons.sh" ]; then
    bash "$SCRIPT_DIR/ensure-crons.sh"
  fi
}

main() {
  require_cmd git
  require_cmd docker
  require_cmd python3
  require_cmd curl

  install_hermes
  ensure_migration
  write_env_file
  write_config_file
  sync_context
  ensure_crons
  install_gateway_service

  log "Bootstrap concluido"
  hermes version
  hermes status || true
}

main "$@"
