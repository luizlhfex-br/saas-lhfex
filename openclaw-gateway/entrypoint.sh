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
  git remote add origin "https://${GITHUB_BACKUP_TOKEN}@github.com/${GITHUB_BACKUP_REPO}.git" 2>/dev/null || true
  git fetch origin openclaw-memory --depth=1 2>/dev/null || true
  git checkout -B openclaw-memory 2>/dev/null || true
  git config user.email "openclaw@lhfex.com.br" 2>/dev/null || true
  git config user.name "OpenClaw LHFEX" 2>/dev/null || true

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
# Schema correto: { "version": 1, "jobs": [...] }
# Ref: openclaw@2026.2.26 CronJobSchema (send-*.js)
CRON_DIR=/root/.openclaw/cron
mkdir -p "$CRON_DIR"

if [ ! -f "$CRON_DIR/jobs.json" ]; then
  echo "[openclaw] Criando cron jobs (formato v1)..."
  cat > "$CRON_DIR/jobs.json" << 'CRONEOF'
{
  "version": 1,
  "jobs": [
    {
      "id": "morning-brief",
      "name": "morning_brief",
      "description": "Briefing matinal com processos, tarefas e KPIs",
      "enabled": true,
      "deleteAfterRun": false,
      "createdAtMs": 1772323200000,
      "updatedAtMs": 1772323200000,
      "schedule": {
        "kind": "cron",
        "expr": "0 8 * * 1-5",
        "tz": "America/Sao_Paulo",
        "staggerMs": 0
      },
      "sessionTarget": "main",
      "wakeMode": "now",
      "payload": {
        "kind": "agentTurn",
        "message": "BRIEFING MATINAL: Gerar briefing completo do dia para Luiz. Consultar via web_fetch: 1) action=resumo_processos (processos vencendo hoje/amanhã, alertas) 2) Tarefas bloqueadas no Mission Control 3) KPIs principais. Enviar resumo estruturado no Telegram para Luiz (chat_id 916838588). Seja direto e use números concretos."
      },
      "state": {}
    },
    {
      "id": "process-alerts-am",
      "name": "process_alerts_am",
      "description": "Alerta de processos em risco - manhã",
      "enabled": true,
      "deleteAfterRun": false,
      "createdAtMs": 1772323200000,
      "updatedAtMs": 1772323200000,
      "schedule": {
        "kind": "cron",
        "expr": "0 9 * * 1-5",
        "tz": "America/Sao_Paulo",
        "staggerMs": 0
      },
      "sessionTarget": "main",
      "wakeMode": "now",
      "payload": {
        "kind": "agentTurn",
        "message": "ALERTA DE PROCESSOS (manhã): Verificar processos em risco via web_fetch action=resumo_processos. Se há processos vencendo em 3 dias ou com alertas, notificar Luiz no Telegram com lista detalhada. Se tudo OK, não notificar."
      },
      "state": {}
    },
    {
      "id": "process-alerts-pm",
      "name": "process_alerts_pm",
      "description": "Alerta de processos em risco - tarde",
      "enabled": true,
      "deleteAfterRun": false,
      "createdAtMs": 1772323200000,
      "updatedAtMs": 1772323200000,
      "schedule": {
        "kind": "cron",
        "expr": "0 17 * * 1-5",
        "tz": "America/Sao_Paulo",
        "staggerMs": 0
      },
      "sessionTarget": "main",
      "wakeMode": "now",
      "payload": {
        "kind": "agentTurn",
        "message": "ALERTA DE PROCESSOS (tarde): Verificar processos em risco via web_fetch action=resumo_processos. Se há processos vencendo em 3 dias ou com alertas, notificar Luiz no Telegram com lista detalhada. Se tudo OK, não notificar."
      },
      "state": {}
    },
    {
      "id": "api-limits-check",
      "name": "api_limits_check",
      "description": "Verificação diária de limites de API",
      "enabled": true,
      "deleteAfterRun": false,
      "createdAtMs": 1772323200000,
      "updatedAtMs": 1772323200000,
      "schedule": {
        "kind": "cron",
        "expr": "0 18 * * *",
        "tz": "America/Sao_Paulo",
        "staggerMs": 0
      },
      "sessionTarget": "main",
      "wakeMode": "now",
      "payload": {
        "kind": "agentTurn",
        "message": "API LIMITS: Verificar system_status via web_fetch action=system_status. Se qualquer limite de API acima de 80% do quota, alertar Luiz no Telegram com detalhes. Se tudo OK, não notificar."
      },
      "state": {}
    }
  ]
}
CRONEOF
  echo "[openclaw] Cron jobs criados: morning_brief, process_alerts x2, api_limits."
else
  echo "[openclaw] Cron jobs já existem, mantendo."
fi

# ── GATEWAY ───────────────────────────────────────────────────────────────────
echo "[openclaw] Iniciando gateway na porta 18789..."
LOG="$WORKSPACE/gateway-startup.log"

# Imprimir log de crash anterior no stdout (visível no Coolify Logs)
if [ -f "$LOG" ] && [ -s "$LOG" ]; then
  echo "========== CRASH LOG ANTERIOR =========="
  cat "$LOG"
  echo "========================================="
  rm -f "$LOG"
fi

# Capturar stdout+stderr do gateway em arquivo temporário
# Em crash-loop o processo sai rápido — buffer é OK
echo "[startup $(date)]" > /tmp/gw.log
openclaw gateway >> /tmp/gw.log 2>&1
EXIT_CODE=$?
echo "[exit code=$EXIT_CODE at $(date)]" >> /tmp/gw.log
# Imprimir no stdout (visível no Coolify Logs) e salvar no volume persistente
cat /tmp/gw.log
cat /tmp/gw.log >> "$LOG"
exit $EXIT_CODE
