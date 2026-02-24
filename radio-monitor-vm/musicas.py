#!/usr/bin/env python3
"""
LHFEX Radio Monitor — Projeto 2: Identificação de Músicas (ACRCloud)
=====================================================================

Identifica músicas tocadas nas rádios monitoradas usando a API ACRCloud
(fingerprinting de áudio — Shazam simplificado).

Busca estações e credenciais ACRCloud do LHFEX SaaS via API.
Quando identifica uma música com confiança >= 70, envia ao SAAS
que salva no banco e exibe na UI do Radio Monitor.

Requisitos:
  pip3 install requests

ffmpeg deve estar instalado:
  sudo apt install ffmpeg -y

Configuração (config.json — mesmo arquivo do monitor.py):
  Veja config.example.json — preencha saas_url e radio_monitor_secret.

Variáveis de ambiente no SAAS (Coolify):
  ACRCLOUD_HOST         = identify-eu-west-1.acrcloud.com
  ACRCLOUD_ACCESS_KEY   = <sua access key>
  ACRCLOUD_ACCESS_SECRET = <seu access secret>

Free tier ACRCloud: 3 horas/dia de identificação (~720 chamadas de 15s/dia).

Uso:
  python3 musicas.py           # loop contínuo (padrão: 30min entre ciclos)
  python3 musicas.py --once    # roda apenas um ciclo e encerra
  python3 musicas.py --test    # testa sem salvar (só printa resultado)
"""

import json
import sys
import os
import subprocess
import time
import signal
import logging
import base64
import hmac
import hashlib
from datetime import datetime, timezone, timedelta
from pathlib import Path

import requests

# ── Configuração ───────────────────────────────────────────────────────────

CONFIG_FILE = Path(__file__).parent / "config.json"

CAPTURE_DURATION_S = 15       # Segundos de áudio por identificação
INTERVAL_S = 1800             # 30 minutos entre ciclos completos
MIN_CONFIDENCE = 70           # Score mínimo ACRCloud para salvar (0-100)
CONFIG_REFRESH_S = 600        # Atualiza config do SAAS a cada 10 min

BRASILIA_TZ = timezone(timedelta(hours=-3))

# ── Logging ────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(Path(__file__).parent / "musicas.log", encoding="utf-8"),
    ],
)
log = logging.getLogger("musicas")

# ── Helpers ────────────────────────────────────────────────────────────────

def load_config() -> dict:
    """Carrega config.json com saas_url e radio_monitor_secret."""
    if not CONFIG_FILE.exists():
        log.error("config.json não encontrado em %s", CONFIG_FILE)
        log.error("Crie a partir de config.example.json e preencha saas_url e radio_monitor_secret.")
        sys.exit(1)
    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def fetch_saas_config(saas_url: str, secret: str) -> dict:
    """Busca estações ativas e credenciais ACRCloud do SAAS."""
    try:
        resp = requests.get(
            f"{saas_url}/api/radio-monitor-config",
            headers={"x-radio-monitor-key": secret},
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        log.error("Falha ao buscar config do SAAS: %s", e)
        return {}


def build_acrcloud_signature(access_key: str, access_secret: str) -> tuple[str, str, str]:
    """
    Gera timestamp e assinatura HMAC-SHA1 para autenticação ACRCloud.
    Retorna (timestamp, signature, string_to_sign).
    """
    timestamp = str(int(time.time()))
    data_type = "audio"
    signature_version = "1"
    string_to_sign = "\n".join([
        "POST",
        "/v1/identify",
        access_key,
        data_type,
        signature_version,
        timestamp,
    ])
    hmac_obj = hmac.new(
        access_secret.encode("utf-8"),
        string_to_sign.encode("utf-8"),
        hashlib.sha1,
    )
    signature = base64.b64encode(hmac_obj.digest()).decode("utf-8")
    return timestamp, signature, string_to_sign


def capture_audio(stream_url: str, duration: int = CAPTURE_DURATION_S) -> bytes | None:
    """
    Captura 'duration' segundos de áudio do stream e retorna como bytes MP3.
    Usa ffmpeg (mesmo padrão do monitor.py mas menor e para ACRCloud).
    """
    cmd = [
        "ffmpeg",
        "-y",                        # sobrescreve sem perguntar
        "-i", stream_url,
        "-t", str(duration),         # duração máxima
        "-ar", "8000",               # ACRCloud aceita 8kHz
        "-ac", "1",                  # mono
        "-f", "mp3",
        "-loglevel", "error",
        "pipe:1",                    # saída para stdout
    ]
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            timeout=duration + 20,
        )
        if result.returncode != 0:
            log.warning("ffmpeg retornou código %d: %s", result.returncode, result.stderr.decode()[:200])
            return None
        audio_bytes = result.stdout
        if len(audio_bytes) < 1024:
            log.warning("Áudio muito curto (%d bytes) — stream offline?", len(audio_bytes))
            return None
        return audio_bytes
    except subprocess.TimeoutExpired:
        log.warning("Timeout ao capturar áudio de %s", stream_url)
        return None
    except FileNotFoundError:
        log.error("ffmpeg não encontrado. Instale com: sudo apt install ffmpeg -y")
        return None
    except Exception as e:
        log.error("Erro ao capturar áudio: %s", e)
        return None


def identify_song(
    audio_bytes: bytes,
    host: str,
    access_key: str,
    access_secret: str,
) -> dict | None:
    """
    Envia áudio ao ACRCloud e retorna metadados da música identificada.
    Retorna None se não identificou ou se confiança < MIN_CONFIDENCE.
    """
    timestamp, signature, _ = build_acrcloud_signature(access_key, access_secret)

    try:
        response = requests.post(
            f"https://{host}/v1/identify",
            data={
                "sample_bytes": str(len(audio_bytes)),
                "access_key": access_key,
                "data_type": "audio",
                "signature_version": "1",
                "signature": signature,
                "timestamp": timestamp,
            },
            files={"sample": ("segment.mp3", audio_bytes, "audio/mpeg")},
            timeout=30,
        )
        response.raise_for_status()
        result = response.json()
    except Exception as e:
        log.error("Erro na chamada ACRCloud: %s", e)
        return None

    # Verifica se identificou algo
    status_code = result.get("status", {}).get("code", -1)
    if status_code != 0:
        # 1001 = não identificado; outros = erro
        if status_code != 1001:
            log.warning("ACRCloud erro %d: %s", status_code, result.get("status", {}).get("msg", ""))
        return None

    # Extrai metadados da primeira música
    music_list = result.get("metadata", {}).get("music", [])
    if not music_list:
        return None

    music = music_list[0]
    score = music.get("score", 0)

    if score < MIN_CONFIDENCE:
        log.debug("Música identificada mas confiança baixa: %.0f%% — ignorando", score)
        return None

    title = music.get("title", "").strip()
    artists = music.get("artists", [])
    artist = artists[0].get("name", "").strip() if artists else ""
    album = music.get("album", {}).get("name", "").strip() or None
    release_date = music.get("release_date", "") or ""
    release_year = None
    if release_date and len(release_date) >= 4:
        try:
            release_year = int(release_date[:4])
        except ValueError:
            pass

    if not title or not artist:
        return None

    return {
        "title": title,
        "artist": artist,
        "album": album,
        "releaseYear": release_year,
        "confidence": round(score, 2),
    }


def post_song(
    saas_url: str,
    secret: str,
    station_id: str,
    song_info: dict,
    test_mode: bool = False,
) -> bool:
    """Envia música identificada para o SAAS. Retorna True se sucesso."""
    payload = {
        "stationId": station_id,
        "title": song_info["title"],
        "artist": song_info["artist"],
        "album": song_info.get("album"),
        "releaseYear": song_info.get("releaseYear"),
        "confidence": song_info.get("confidence"),
        "detectedAt": datetime.now(BRASILIA_TZ).isoformat(),
    }

    if test_mode:
        log.info("[TEST] Payload que seria enviado: %s", json.dumps(payload, ensure_ascii=False))
        return True

    try:
        resp = requests.post(
            f"{saas_url}/api/radio-monitor-song",
            headers={
                "x-radio-monitor-key": secret,
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=10,
        )
        resp.raise_for_status()
        return True
    except Exception as e:
        log.error("Falha ao enviar música ao SAAS: %s", e)
        return False


# ── Loop principal ─────────────────────────────────────────────────────────

class MusicMonitor:
    def __init__(self, once: bool = False, test_mode: bool = False):
        self.once = once
        self.test_mode = test_mode
        self.running = True
        self.config = {}
        self.saas_data = {}
        self.last_config_fetch = 0

        signal.signal(signal.SIGINT, self._shutdown)
        signal.signal(signal.SIGTERM, self._shutdown)

    def _shutdown(self, *args):
        log.info("Encerrando musicas.py...")
        self.running = False

    def _refresh_config(self):
        now = time.time()
        if now - self.last_config_fetch < CONFIG_REFRESH_S and self.saas_data:
            return
        self.config = load_config()
        self.saas_data = fetch_saas_config(
            self.config.get("saas_url", ""),
            self.config.get("radio_monitor_secret", ""),
        )
        self.last_config_fetch = now
        stations = self.saas_data.get("stations", [])
        acrcloud = self.saas_data.get("acrcloud", {})
        log.info(
            "Config atualizada: %d estação(ões) ativas | ACRCloud host: %s",
            len(stations),
            acrcloud.get("host", "não configurado"),
        )

    def run_cycle(self):
        """Roda um ciclo completo: identifica músicas em todas as estações ativas."""
        self._refresh_config()

        stations = self.saas_data.get("stations", [])
        acrcloud = self.saas_data.get("acrcloud", {})
        saas_url = self.config.get("saas_url", "")
        secret = self.config.get("radio_monitor_secret", "")

        host = acrcloud.get("host", "").strip()
        access_key = acrcloud.get("access_key", "").strip()
        access_secret = acrcloud.get("access_secret", "").strip()

        if not host or not access_key or not access_secret:
            log.warning(
                "Credenciais ACRCloud não configuradas. "
                "Configure ACRCLOUD_HOST, ACRCLOUD_ACCESS_KEY e ACRCLOUD_ACCESS_SECRET no SAAS (Coolify)."
            )
            return

        if not stations:
            log.info("Nenhuma estação ativa para monitorar.")
            return

        identified = 0
        for station in stations:
            if not self.running:
                break

            stream_url = station.get("streamUrl")
            if not stream_url:
                log.debug("Estação '%s' sem streamUrl — pulando.", station.get("name", "?"))
                continue

            station_name = station.get("name", station.get("id", "?"))
            log.info("Capturando %ds de áudio: %s (%s)", CAPTURE_DURATION_S, station_name, stream_url[:60])

            audio = capture_audio(stream_url, CAPTURE_DURATION_S)
            if audio is None:
                log.warning("Sem áudio de '%s' — pulando.", station_name)
                continue

            log.info("Identificando via ACRCloud (%d bytes)...", len(audio))
            song = identify_song(audio, host, access_key, access_secret)

            if song is None:
                log.info("'%s': música não identificada ou confiança insuficiente.", station_name)
                continue

            log.info(
                "'%s': 🎵 %s — %s (%.0f%% confiança)",
                station_name,
                song["title"],
                song["artist"],
                song.get("confidence", 0),
            )

            ok = post_song(saas_url, secret, station["id"], song, self.test_mode)
            if ok and not self.test_mode:
                identified += 1

            # Pequena pausa entre estações para não sobrecarregar
            time.sleep(2)

        log.info("Ciclo concluído: %d música(s) identificada(s) e salva(s).", identified)

    def run(self):
        log.info("=" * 60)
        log.info("LHFEX Musicas Monitor iniciando")
        log.info("Modo: %s", "TESTE" if self.test_mode else ("único ciclo" if self.once else "loop contínuo"))
        log.info("Intervalo entre ciclos: %ds (%.0fmin)", INTERVAL_S, INTERVAL_S / 60)
        log.info("Confiança mínima ACRCloud: %d%%", MIN_CONFIDENCE)
        log.info("=" * 60)

        if self.once or self.test_mode:
            self.run_cycle()
            return

        while self.running:
            self.run_cycle()
            if self.running:
                log.info("Aguardando %ds até o próximo ciclo...", INTERVAL_S)
                for _ in range(INTERVAL_S):
                    if not self.running:
                        break
                    time.sleep(1)

        log.info("musicas.py encerrado.")


# ── Entry point ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    once = "--once" in sys.argv
    test_mode = "--test" in sys.argv

    monitor = MusicMonitor(once=once, test_mode=test_mode)
    monitor.run()
