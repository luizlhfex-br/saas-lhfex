#!/bin/sh
set -e

# ── SKILLS ────────────────────────────────────────────────────────────────────
echo "[openclaw] Installing skills..."
clawhub install qmd web-search file-ops reminders 2>/dev/null || true
clawhub update --all 2>/dev/null || true

# ── WORKSPACE ─────────────────────────────────────────────────────────────────
WORKSPACE=/root/.openclaw/workspace
mkdir -p "$WORKSPACE"

# Copia prompts → workspace apenas na primeira execução (volume persistente)
for f in SOUL.md IDENTITY.md USER.md AGENTS.md WORKING.md; do
  src="/root/.openclaw/prompts/$f"
  dst="$WORKSPACE/$f"
  if [ -f "$src" ] && [ ! -f "$dst" ]; then
    cp "$src" "$dst"
    echo "[openclaw] Copied $f to workspace."
  fi
done

echo "[openclaw] Workspace ready."

# ── GITHUB BACKUP ─────────────────────────────────────────────────────────────
if [ -n "$GITHUB_BACKUP_TOKEN" ] && [ -n "$GITHUB_BACKUP_REPO" ]; then
  echo "[openclaw] Setting up GitHub backup → branch openclaw-memory..."
  cd "$WORKSPACE"
  git init 2>/dev/null || true
  git remote rm origin 2>/dev/null || true
  git remote add origin "https://${GITHUB_BACKUP_TOKEN}@github.com/${GITHUB_BACKUP_REPO}.git"
  git fetch origin openclaw-memory --depth=1 2>/dev/null || true
  git checkout -B openclaw-memory 2>/dev/null || true
  git config user.email "openclaw@lhfex.com.br"
  git config user.name "OpenClaw LHFEX"

  # Loop de backup a cada hora em background
  (while true; do
    sleep 3600
    cd "$WORKSPACE"
    git add -A
    if git commit -m "mem: $(date '+%Y-%m-%d %H:%M')" 2>/dev/null; then
      git push -u origin openclaw-memory --force 2>/dev/null \
        || echo "[backup] Push falhou, tentando novamente em 1h"
    fi
  done) &

  cd /root/.openclaw
  echo "[openclaw] Backup loop iniciado."
fi

# ── CRON JOBS ─────────────────────────────────────────────────────────────────
# Cria diretório de cron jobs
CRON_DIR=/root/.openclaw/cron
mkdir -p "$CRON_DIR"

if [ ! -f "$CRON_DIR/jobs.json" ]; then
  echo "[openclaw] Criando cron jobs..."
  cat > "$CRON_DIR/jobs.json" << 'CRONEOF'
[
  {
    "id": "morning-brief",
    "name": "morning_brief",
    "schedule": "0 8 * * 1-5",
    "timezone": "America/Sao_Paulo",
    "enabled": true,
    "message": "BRIEFING MATINAL: Gerar briefing completo do dia para Luiz. Consultar: 1) resumo_processos (processos vencendo hoje/amanhã, alertas) 2) Tarefas bloqueadas no Mission Control 3) KPIs principais. Enviar resumo estruturado no Telegram para Luiz (chat_id 916838588). Seja direto e use números concretos."
  },
  {
    "id": "process-alerts-am",
    "name": "process_alerts_am",
    "schedule": "0 9 * * 1-5",
    "timezone": "America/Sao_Paulo",
    "enabled": true,
    "message": "ALERTA DE PROCESSOS (manhã): Verificar processos em risco via action=resumo_processos. Se há processos vencendo em ≤3 dias ou com alertas, notificar Luiz no Telegram com lista detalhada. Se tudo OK, responder HEARTBEAT_OK sem notificar."
  },
  {
    "id": "process-alerts-pm",
    "name": "process_alerts_pm",
    "schedule": "0 17 * * 1-5",
    "timezone": "America/Sao_Paulo",
    "enabled": true,
    "message": "ALERTA DE PROCESSOS (tarde): Verificar processos em risco via action=resumo_processos. Se há processos vencendo em ≤3 dias ou com alertas, notificar Luiz no Telegram com lista detalhada. Se tudo OK, responder HEARTBEAT_OK sem notificar."
  },
  {
    "id": "api-limits-check",
    "name": "api_limits_check",
    "schedule": "0 18 * * *",
    "timezone": "America/Sao_Paulo",
    "enabled": true,
    "message": "API LIMITS: Verificar system_status via action=system_status. Se qualquer limite de API está acima de 80% do quota, alertar Luiz no Telegram com detalhes. Se tudo OK, responder HEARTBEAT_OK sem notificar."
  }
]
CRONEOF
  echo "[openclaw] Cron jobs criados (4 jobs: morning_brief, process_alerts x2, api_limits)."
else
  echo "[openclaw] Cron jobs já existem, pulando criação."
fi

# ── GATEWAY ───────────────────────────────────────────────────────────────────
echo "[openclaw] Iniciando gateway na porta 18789..."
exec openclaw gateway
