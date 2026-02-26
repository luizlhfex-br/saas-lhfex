#!/bin/sh
set -e

# Instalar/atualizar skills
echo "[openclaw] Installing skills..."
clawhub install qmd web-search file-ops reminders 2>/dev/null || true
clawhub update --all 2>/dev/null || true

# Inicializar arquivos de workspace (Mission Control)
WORKSPACE=/root/.openclaw/workspace
mkdir -p "$WORKSPACE"

# Copiar prompts para workspace se não existirem (primeira vez)
[ -f "$WORKSPACE/SOUL.md"    ] || cp /root/.openclaw/prompts/SOUL.md    "$WORKSPACE/"
[ -f "$WORKSPACE/IDENTITY.md"] || cp /root/.openclaw/prompts/IDENTITY.md "$WORKSPACE/"
[ -f "$WORKSPACE/USER.md"    ] || cp /root/.openclaw/prompts/USER.md    "$WORKSPACE/"
[ -f "$WORKSPACE/AGENTS.md"  ] || cp /root/.openclaw/prompts/AGENTS.md  "$WORKSPACE/"
[ -f "$WORKSPACE/WORKING.md" ] || cp /root/.openclaw/prompts/WORKING.md "$WORKSPACE/"

echo "[openclaw] Workspace initialized."

# Backup automático no repo SAAS (branch openclaw-memory)
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

  # Background backup loop: a cada hora
  (while true; do
    sleep 3600
    cd "$WORKSPACE"
    git add -A
    if git commit -m "mem: $(date '+%Y-%m-%d %H:%M')" 2>/dev/null; then
      git push -u origin openclaw-memory --force 2>/dev/null || echo "[backup] Push failed, will retry in 1h"
    fi
  done) &

  cd /root/.openclaw
  echo "[openclaw] Backup loop started."
fi

echo "[openclaw] Starting gateway..."
exec openclaw gateway
