#!/usr/bin/env bash
set -euo pipefail

HERMES_HOME="${HERMES_HOME:-/root/.hermes}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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
if [ -f "$SCRIPT_DIR/ensure-crons.sh" ]; then
  bash "$SCRIPT_DIR/ensure-crons.sh"
fi
printf '[hermes-sync] contexto sincronizado em %s\n' "$HERMES_HOME"
