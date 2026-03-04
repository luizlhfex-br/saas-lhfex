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

# Sempre copia skills/ locais — protocolo de debugging e skills customizadas
if [ -d "/root/.openclaw/prompts/skills" ]; then
  mkdir -p "$WORKSPACE/skills"
  cp -r /root/.openclaw/prompts/skills/. "$WORKSPACE/skills/"
  echo "[openclaw] Skills locais copiadas para workspace ($(ls /root/.openclaw/prompts/skills/ | wc -l) arquivos)."
fi

# Sempre atualiza SOUL.md e CHANGELOG.md — garante regras e histórico atualizados
# (sobrescreve versão antiga no volume persistente)
if [ -f "/root/.openclaw/prompts/SOUL.md" ]; then
  cp "/root/.openclaw/prompts/SOUL.md" "$WORKSPACE/SOUL.md"
  echo "[openclaw] SOUL.md atualizado no workspace."
fi
if [ -f "/root/.openclaw/prompts/CHANGELOG.md" ]; then
  cp "/root/.openclaw/prompts/CHANGELOG.md" "$WORKSPACE/CHANGELOG.md"
  echo "[openclaw] CHANGELOG.md disponível no workspace."
fi

# Cria estrutura de memória organizada (Fase 4 — Bruno Okamoto)
mkdir -p "$WORKSPACE/memory"
for memfile in decisions.md projects.md people.md lessons.md pending.md; do
  if [ ! -f "$WORKSPACE/memory/$memfile" ]; then
    echo "# $memfile\n<!-- Arquivo de memória estruturada do OpenClaw -->" > "$WORKSPACE/memory/$memfile"
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
# SEMPRE recria o arquivo com a versão mais recente dos jobs.
# Isso garante que novos jobs adicionados aqui entrem em vigor no próximo deploy.
CRON_DIR=/root/.openclaw/cron
mkdir -p "$CRON_DIR"

echo "[openclaw] Recriando cron jobs (versão 2026-03-03)..."
cat > "$CRON_DIR/jobs.json" << 'CRONEOF'
{
  "version": 1,
  "jobs": [
    {
      "id": "openclaw-update-check",
      "name": "openclaw_update_check",
      "description": "Verifica se há nova versão do OpenClaw disponível",
      "enabled": true,
      "deleteAfterRun": false,
      "createdAtMs": 1772323200000,
      "updatedAtMs": 1772496000000,
      "schedule": {
        "kind": "cron",
        "expr": "0 10 * * *",
        "tz": "America/Sao_Paulo",
        "staggerMs": 0
      },
      "sessionTarget": "main",
      "wakeMode": "now",
      "payload": {
        "kind": "agentTurn",
        "message": "UPDATE CHECK: Verifique se há uma nova versão do OpenClaw disponível. Acesse https://github.com/openclaw/openclaw/releases via web_fetch e compare com a versão atual registrada em WORKING.md ou no sistema. Se houver versão mais nova que a atual (2026.2.26), notifique Luiz no Telegram com: 1) Versão nova disponível 2) Data de lançamento 3) Resumo das novidades principais 4) Recomendação: vale atualizar agora? 5) Pergunta se quer o comando de atualização. Se não há versão nova: silêncio total, não notificar."
      },
      "state": {}
    },
    {
      "id": "vps-daily-status",
      "name": "vps_daily_status",
      "description": "Relatório diário do status do VPS (7h)",
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
        "message": "VPS STATUS DIÁRIO: Verifique o status do sistema via web_fetch action=system_status no SAAS. Envie um relatório resumido para o Luiz APENAS se houver algum problema: CPU acima de 80% por período prolongado, disco acima de 85%, serviços down, ou erros críticos recentes. Se tudo estiver normal (CPU < 80%, disco < 85%, serviços OK), NÃO envie mensagem — silêncio é sinal de saúde."
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
        "message": "BRIEFING MATINAL: Envie um briefing conciso para o Luiz no Telegram. Inclua: 1) Bom dia com data de hoje 2) Processos LHFEX urgentes ou vencendo hoje/amanhã (via web_fetch action=resumo_processos) — se nenhum, diga 'processos: tudo OK' 3) Tarefas pessoais pendentes do WORKING.md se houver 4) Uma dica ou motivação curta (1 frase). Use emojis com moderação. Seja direto: máximo 10 linhas."
      },
      "state": {}
    },
    {
      "id": "morning-brief",
      "name": "morning_brief",
      "description": "Briefing LHFEX detalhado (8h dias úteis) — substitui o matinal nos úteis",
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
        "message": "BRIEFING LHFEX (dia útil): Gerar briefing operacional para Luiz. Consultar via web_fetch: 1) action=resumo_processos — processos vencendo hoje/amanhã, alertas críticos 2) action=system_status — status dos serviços. Enviar resumo estruturado no Telegram. Seja direto e use números concretos. Se não há alertas, diga 'operações: sem alertas' e termine aí."
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
        "message": "RESUMO SEMANAL LHFEX: É segunda-feira, hora do relatório semanal. Consultar via web_fetch: 1) action=resumo_processos — todos os processos em aberto, vencimentos desta semana 2) action=system_status — saúde do sistema na semana. Enviar para Luiz no Telegram um resumo semanal com: processos em aberto (quantidade por status), alertas da semana, e próximos vencimentos nos próximos 7 dias. Seja objetivo."
      },
      "state": {}
    },
    {
      "id": "promotions-checker",
      "name": "promotions_checker",
      "description": "Monitor de promoções e sorteios (seg, qua, sex 12h)",
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
        "message": "MONITOR DE PROMOÇÕES: Pesquise promoções e sorteios ativos nos seguintes sites via web_fetch: 1) https://acheipromocao.com.br/ 2) https://portaldapromo.com.br/promocoes/ativas 3) https://pegapromocao.com.br/promocoes/ . Analise e classifique por PRIORIDADE: 🏆 MÁXIMA = gratuitas (só cadastro, sem compra) ou promoções de rádio BH (Itatiaia, CBN, Jovem Pan Minas) | 🥈 ALTA = válidas para MG/Belo Horizonte | 🥉 MÉDIA = Brasil inteiro | ⚠️ BAIXA = apenas outros estados (informe qual estado). Para cada promoção relevante: nome, prazo, como participar, e se vale a pena (avalie o prêmio vs facilidade). Verifique MEMORY.md para não repetir promoções já alertadas. Se não houver promoções novas interessantes, NÃO envie mensagem."
      },
      "state": {}
    },
    {
      "id": "process-alerts-pm",
      "name": "process_alerts_pm",
      "description": "Alerta de processos em risco - tarde (17h dias úteis)",
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
        "message": "ALERTA DE PROCESSOS (tarde): Verificar processos em risco via web_fetch action=resumo_processos. Se há processos vencendo em 3 dias ou com alertas, notificar Luiz no Telegram com lista detalhada. Se tudo OK, não notificar."
      },
      "state": {}
    }
  ]
}
CRONEOF
echo "[openclaw] Cron jobs criados: update-check, vps-daily, personal-morning, morning-brief, lhfex-weekly, promotions-checker, process-alerts-pm."

# ── DEPLOY NOTIFICATION ───────────────────────────────────────────────────────
# Notifica o lhfex_monitor_bot no Telegram sempre que o container reiniciar/deployar
if [ -n "$TELEGRAM_OPENCLAW_BOT_TOKEN" ] && [ -n "$TELEGRAM_LUIZ_CHAT_ID" ]; then
  DEPLOY_MSG="🚀 *OpenClaw reiniciado* — $(date '+%d/%m/%Y %H:%M') BRT%0A"
  DEPLOY_MSG="${DEPLOY_MSG}📦 Gateway v2026.2.26 · 7 crons ativos%0A"
  DEPLOY_MSG="${DEPLOY_MSG}🤖 Gemini 2.0 Flash → OR/auto → DeepSeek → Kimi K2.5"
  curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_OPENCLAW_BOT_TOKEN}/sendMessage" \
    -d "chat_id=${TELEGRAM_LUIZ_CHAT_ID}" \
    -d "text=${DEPLOY_MSG}" \
    -d "parse_mode=Markdown" > /dev/null 2>&1 || true
  echo "[openclaw] Deploy notification enviada."
fi

# ── GATEWAY ───────────────────────────────────────────────────────────────────
echo "[openclaw] Iniciando gateway na porta 18789..."

# exec substitui o shell pelo processo do gateway:
# - stdout/stderr vão direto para Docker logs (Coolify Logs)
# - gateway recebe PID 1 (SIGTERM correto do Docker)
# - sem buffering, sem set -e escondendo erros
exec openclaw gateway
