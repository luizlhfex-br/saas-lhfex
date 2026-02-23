#!/bin/bash
# ============================================================
# LHFEX Radio Monitor — Setup na VPS Oracle (Ubuntu)
# ============================================================
# Execute como: bash setup.sh
# ============================================================

set -e

echo "=== Atualizando sistema ==="
sudo apt update && sudo apt upgrade -y

echo "=== Instalando dependências ==="
sudo apt install python3 python3-pip ffmpeg unzip wget -y

echo "=== Instalando bibliotecas Python ==="
pip3 install vosk requests

echo "=== Baixando modelo VOSK PT-BR (small, ~40MB) ==="
if [ ! -d "vosk-model-small-pt-0.3" ]; then
  wget -q https://alphacephei.com/vosk/models/vosk-model-small-pt-0.3.zip
  unzip -q vosk-model-small-pt-0.3.zip
  rm vosk-model-small-pt-0.3.zip
  echo "Modelo baixado: vosk-model-small-pt-0.3"
else
  echo "Modelo já existe — pulando download"
fi

echo ""
echo "=== Configuração ==="
if [ ! -f "config.json" ]; then
  cp config.example.json config.json
  echo "⚠️  Edite config.json com sua SAAS_URL e RADIO_MONITOR_SECRET:"
  echo "    nano config.json"
else
  echo "config.json já existe"
fi

echo ""
echo "=== Setup completo! ==="
echo ""
echo "Para iniciar em segundo plano (24/7):"
echo "  nohup python3 monitor.py > monitor.log 2>&1 &"
echo ""
echo "Para iniciar com systemd (recomendado — reinicia automaticamente):"
echo "  sudo bash install-service.sh"
echo ""
echo "Para testar manualmente:"
echo "  python3 monitor.py"
