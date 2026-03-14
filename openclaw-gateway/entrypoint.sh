#!/bin/sh
set -e

echo "[openclaw] Installing skills..."
clawhub install qmd web-search file-ops reminders 2>/dev/null || true
clawhub update --all 2>/dev/null || true

ROOT_DIR=/root/.openclaw
PROMPTS_DIR="$ROOT_DIR/prompts"
WORKSPACE="$ROOT_DIR/workspace"
AGENTS_DIR="$WORKSPACE/agents"

mkdir -p "$WORKSPACE" "$AGENTS_DIR"

seed_working_file() {
  target="$1"
  session_key="$2"

  cat > "$target/WORKING.md" <<EOF
# WORKING.md - Estado Atual

**Sessao:** $session_key
**Iniciado:** [sera atualizado automaticamente]
**Ultimo heartbeat:** [sera atualizado automaticamente]

---

## Em Progresso
_nada no momento_

---

## Pendente Revisao
_nada no momento_

---

## Bloqueado
_nada no momento_

---

## Proximas Tarefas
_nada agendado_

---

## Ultimas 5 Decisoes
_sem historico ainda_

---

## Notas da Sessao
Sistema inicializado. Aguardando instrucoes do Luiz ou crons agendados.
EOF
}

copy_shared_workspace_files() {
  target="$1"
  identity_source="$2"
  session_key="$3"

  mkdir -p "$target" "$target/memory" "$target/skills"

  for file in SOUL.md USER.md AGENTS.md CHANGELOG.md; do
    if [ -f "$PROMPTS_DIR/$file" ]; then
      cp "$PROMPTS_DIR/$file" "$target/$file"
    fi
  done

  if [ -f "$identity_source" ]; then
    cp "$identity_source" "$target/IDENTITY.md"
  elif [ -f "$PROMPTS_DIR/IDENTITY.md" ]; then
    cp "$PROMPTS_DIR/IDENTITY.md" "$target/IDENTITY.md"
  fi

  if [ -d "$PROMPTS_DIR/skills" ]; then
    cp -r "$PROMPTS_DIR/skills/." "$target/skills/"
  fi

  for memfile in decisions.md projects.md people.md lessons.md pending.md; do
    if [ ! -f "$target/memory/$memfile" ]; then
      printf '# %s\n<!-- Memoria estruturada do OpenClaw -->\n' "$memfile" > "$target/memory/$memfile"
    fi
  done

  seed_working_file "$target" "$session_key"
}

copy_shared_workspace_files "$WORKSPACE" "$PROMPTS_DIR/IDENTITY.md" "agent:openclaw:main"

for agent_id in airton iana maria iago iara sofia mai julia; do
  copy_shared_workspace_files \
    "$AGENTS_DIR/$agent_id" \
    "$PROMPTS_DIR/agents/$agent_id/IDENTITY.md" \
    "agent:$agent_id:main"
done

echo "[openclaw] Workspaces prontos: principal + 8 agentes."

if [ -n "$GITHUB_BACKUP_TOKEN" ] && [ -n "$GITHUB_BACKUP_REPO" ]; then
  echo "[openclaw] Setting up GitHub backup -> branch openclaw-memory..."
  cd "$WORKSPACE"
  git init 2>/dev/null || true
  git remote rm origin 2>/dev/null || true
  git remote add origin "https://${GITHUB_BACKUP_TOKEN}@github.com/${GITHUB_BACKUP_REPO}.git" 2>/dev/null || true
  git fetch origin openclaw-memory --depth=1 2>/dev/null || true
  git checkout -B openclaw-memory 2>/dev/null || true
  git config user.email "openclaw@lhfex.com.br" 2>/dev/null || true
  git config user.name "OpenClaw LHFEX" 2>/dev/null || true

  (
    while true; do
      sleep 3600
      cd "$WORKSPACE"
      git add -A
      if git commit -m "mem: $(date '+%Y-%m-%d %H:%M')" 2>/dev/null; then
        git push -u origin openclaw-memory --force 2>/dev/null || echo "[backup] Push falhou, tentando novamente em 1h"
      fi
    done
  ) &

  cd "$ROOT_DIR"
  echo "[openclaw] Backup loop iniciado."
fi

CRON_DIR="$ROOT_DIR/cron"
mkdir -p "$CRON_DIR"

echo "[openclaw] Recriando cron jobs (versao 2026-03-14)..."
cat > "$CRON_DIR/jobs.json" <<'CRONEOF'
{
  "version": 1,
  "jobs": [
    {
      "id": "openclaw-update-check",
      "name": "openclaw_update_check",
      "description": "Verifica updates do OpenClaw toda segunda 9h BRT e pede autorizacao antes de atualizar",
      "enabled": true,
      "deleteAfterRun": false,
      "createdAtMs": 1772323200000,
      "updatedAtMs": 1773529200000,
      "schedule": {
        "kind": "cron",
        "expr": "0 9 * * 1",
        "tz": "America/Sao_Paulo",
        "staggerMs": 0
      },
      "sessionTarget": "main",
      "wakeMode": "now",
      "payload": {
        "kind": "agentTurn",
        "message": "UPDATE CHECK: use o exec tool para rodar `openclaw check-update`. Se houver update disponivel, avise Luiz no Telegram com versao encontrada, resumo curto e pedido de autorizacao para atualizar. Nao atualize automaticamente. Se nao houver update, silencio total."
      },
      "state": {}
    },
    {
      "id": "vps-daily-status",
      "name": "vps_daily_status",
      "description": "Relatorio diario do status do VPS (7h)",
      "enabled": true,
      "deleteAfterRun": false,
      "createdAtMs": 1772323200000,
      "updatedAtMs": 1772496000000,
      "schedule": {
        "kind": "cron",
        "expr": "0 7 * * *",
        "tz": "America/Sao_Paulo",
        "staggerMs": 0
      },
      "sessionTarget": "main",
      "wakeMode": "now",
      "payload": {
        "kind": "agentTurn",
        "message": "VPS STATUS DIARIO: verifique o status do sistema via web_fetch action=system_status no SAAS. Envie um relatorio resumido para o Luiz apenas se houver CPU acima de 80%, disco acima de 85%, servicos down ou erro critico recente. Se estiver normal, silencio."
      },
      "state": {}
    },
    {
      "id": "personal-morning",
      "name": "personal_morning",
      "description": "Briefing matinal pessoal (8h todos os dias)",
      "enabled": true,
      "deleteAfterRun": false,
      "createdAtMs": 1772323200000,
      "updatedAtMs": 1772496000000,
      "schedule": {
        "kind": "cron",
        "expr": "0 8 * * *",
        "tz": "America/Sao_Paulo",
        "staggerMs": 0
      },
      "sessionTarget": "main",
      "wakeMode": "now",
      "payload": {
        "kind": "agentTurn",
        "message": "BRIEFING MATINAL: envie um briefing conciso para o Luiz no Telegram com data de hoje, processos LHFEX urgentes ou vencendo hoje/amanha, tarefas pessoais pendentes no WORKING.md e uma dica curta. Maximo de 10 linhas."
      },
      "state": {}
    },
    {
      "id": "morning-brief",
      "name": "morning_brief",
      "description": "Briefing LHFEX detalhado (8h30 dias uteis)",
      "enabled": true,
      "deleteAfterRun": false,
      "createdAtMs": 1772323200000,
      "updatedAtMs": 1772496000000,
      "schedule": {
        "kind": "cron",
        "expr": "30 8 * * 1-5",
        "tz": "America/Sao_Paulo",
        "staggerMs": 0
      },
      "sessionTarget": "main",
      "wakeMode": "now",
      "payload": {
        "kind": "agentTurn",
        "message": "BRIEFING LHFEX: consultar action=resumo_processos e action=system_status. Enviar resumo direto no Telegram com alertas, proximos vencimentos e status geral. Se nao houver alertas, diga apenas 'operacoes: sem alertas'."
      },
      "state": {}
    },
    {
      "id": "lhfex-weekly",
      "name": "lhfex_weekly",
      "description": "Resumo semanal LHFEX (segunda 9h)",
      "enabled": true,
      "deleteAfterRun": false,
      "createdAtMs": 1772323200000,
      "updatedAtMs": 1772496000000,
      "schedule": {
        "kind": "cron",
        "expr": "0 9 * * 1",
        "tz": "America/Sao_Paulo",
        "staggerMs": 0
      },
      "sessionTarget": "main",
      "wakeMode": "now",
      "payload": {
        "kind": "agentTurn",
        "message": "RESUMO SEMANAL LHFEX: consultar action=resumo_processos e action=system_status. Enviar para Luiz um resumo semanal com quantidade por status, alertas da semana e vencimentos dos proximos 7 dias."
      },
      "state": {}
    },
    {
      "id": "promotions-checker",
      "name": "promotions_checker",
      "description": "Monitor de promocoes e sorteios (seg, qua, sex 12h)",
      "enabled": true,
      "deleteAfterRun": false,
      "createdAtMs": 1772323200000,
      "updatedAtMs": 1772496000000,
      "schedule": {
        "kind": "cron",
        "expr": "0 12 * * 1,3,5",
        "tz": "America/Sao_Paulo",
        "staggerMs": 0
      },
      "sessionTarget": "main",
      "wakeMode": "now",
      "payload": {
        "kind": "agentTurn",
        "message": "MONITOR DE PROMOCOES: pesquise promocoes e sorteios ativos nos sites monitorados, priorize oportunidades gratuitas ou relevantes para BH/MG, evite repetir itens ja alertados e so envie mensagem se houver oportunidade nova interessante."
      },
      "state": {}
    },
    {
      "id": "process-alerts-pm",
      "name": "process_alerts_pm",
      "description": "Alerta de processos em risco - tarde (17h dias uteis)",
      "enabled": true,
      "deleteAfterRun": false,
      "createdAtMs": 1772323200000,
      "updatedAtMs": 1772496000000,
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
        "message": "ALERTA DE PROCESSOS: verifique action=resumo_processos. Se houver processos vencendo em 3 dias ou com alerta, notifique Luiz com lista detalhada. Se tudo estiver OK, nao envie mensagem."
      },
      "state": {}
    },
    {
      "id": "self-heartbeat",
      "name": "self_heartbeat",
      "description": "Confirma que o OpenClaw esta online 3x por dia",
      "enabled": true,
      "deleteAfterRun": false,
      "createdAtMs": 1772496000000,
      "updatedAtMs": 1772496000000,
      "schedule": {
        "kind": "cron",
        "expr": "0 9,15,21 * * *",
        "tz": "America/Sao_Paulo",
        "staggerMs": 0
      },
      "sessionTarget": "main",
      "wakeMode": "now",
      "payload": {
        "kind": "agentTurn",
        "message": "HEARTBEAT: confirme que esta online com a mensagem exata 'OpenClaw online - HH:MM BRT'. Nada mais."
      },
      "state": {}
    }
  ]
}
CRONEOF

echo "[openclaw] Cron jobs criados."

if [ -n "$TELEGRAM_OPENCLAW_BOT_TOKEN" ] && [ -n "$TELEGRAM_LUIZ_CHAT_ID" ]; then
  DEPLOY_MSG="OpenClaw reiniciado - $(date '+%d/%m/%Y %H:%M') BRT%0A"
  DEPLOY_MSG="${DEPLOY_MSG}Gateway v2026.3.2 - 8 agentes especialistas%0A"
  DEPLOY_MSG="${DEPLOY_MSG}Chain: Vertex Gemini -> Qwen Free -> DeepSeek Direct"
  curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_OPENCLAW_BOT_TOKEN}/sendMessage" \
    -d "chat_id=${TELEGRAM_LUIZ_CHAT_ID}" \
    -d "text=${DEPLOY_MSG}" > /dev/null 2>&1 || true
  echo "[openclaw] Deploy notification enviada."
fi

echo "[openclaw] Iniciando gateway na porta 18789..."
exec openclaw gateway
