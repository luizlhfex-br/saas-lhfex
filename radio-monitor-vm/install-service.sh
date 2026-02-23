#!/bin/bash
# ============================================================
# Instala o Radio Monitor como serviço systemd
# Reinicia automaticamente em caso de crash ou reboot da VM
# ============================================================
# Execute como: sudo bash install-service.sh
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_USER="${SUDO_USER:-ubuntu}"

echo "Instalando serviço systemd: lhfex-radio-monitor"
echo "Diretório: $SCRIPT_DIR"
echo "Usuário: $SERVICE_USER"

cat > /etc/systemd/system/lhfex-radio-monitor.service << EOF
[Unit]
Description=LHFEX Radio Monitor (VOSK PT-BR)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${SCRIPT_DIR}
ExecStart=/usr/bin/python3 ${SCRIPT_DIR}/monitor.py
Restart=on-failure
RestartSec=30
StandardOutput=journal
StandardError=journal
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable lhfex-radio-monitor
systemctl start lhfex-radio-monitor

echo ""
echo "=== Serviço instalado e iniciado! ==="
echo ""
echo "Comandos úteis:"
echo "  sudo systemctl status lhfex-radio-monitor   # ver status"
echo "  sudo journalctl -fu lhfex-radio-monitor      # ver logs ao vivo"
echo "  sudo systemctl restart lhfex-radio-monitor   # reiniciar"
echo "  sudo systemctl stop lhfex-radio-monitor      # parar"
