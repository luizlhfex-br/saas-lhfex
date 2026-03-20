#!/usr/bin/env bash
set -euo pipefail

HERMES_HOME="${HERMES_HOME:-/root/.hermes}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

mkdir -p "$HERMES_HOME/skills"
cp "$SCRIPT_DIR/SOUL.md" "$HERMES_HOME/SOUL.md"

rm -rf "$HERMES_HOME/skills/lhfex-saas" \
       "$HERMES_HOME/skills/lhfex-runtime" \
       "$HERMES_HOME/skills/lhfex-squad-router" \
       "$HERMES_HOME/skills/lhfex-comex-expert" \
       "$HERMES_HOME/skills/lhfex-licitacoes" \
       "$HERMES_HOME/skills/lhfex-promocoes" \
       "$HERMES_HOME/skills/musa-literaria"

cp -R "$SCRIPT_DIR/skills/"* "$HERMES_HOME/skills/"
printf '[hermes-sync] contexto sincronizado em %s\n' "$HERMES_HOME"
