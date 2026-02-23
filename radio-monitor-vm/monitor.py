#!/usr/bin/env python3
"""
LHFEX Radio Monitor — Versão VM (VOSK PT-BR)
============================================

Monitora streams de rádio 24/7 usando VOSK (offline, gratuito).
Busca estações e palavras-chave do LHFEX SaaS via API.
Quando detecta uma keyword, envia o evento de volta ao SAAS
que notifica via Telegram (@lhfex_openclaw_bot).

Requisitos:
  pip3 install vosk requests

Instalar VOSK PT-BR:
  wget https://alphacephei.com/vosk/models/vosk-model-small-pt-0.3.zip
  unzip vosk-model-small-pt-0.3.zip

  (modelo maior, mais preciso — opcional):
  wget https://alphacephei.com/vosk/models/vosk-model-pt-fb-v0.1.1-20220516_2113.zip
  unzip vosk-model-pt-fb-v0.1.1-20220516_2113.zip

ffmpeg deve estar instalado:
  sudo apt install ffmpeg -y

Configuração (config.json):
  Veja config.example.json — preencha SAAS_URL e RADIO_MONITOR_SECRET.
"""

import json
import os
import subprocess
import time
import threading
import queue
import signal
import sys
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path

import requests
from vosk import Model, KaldiRecognizer

# ── Configuração ───────────────────────────────────────────────────────────

CONFIG_FILE = Path(__file__).parent / "config.json"
VOSK_MODEL_DIR = None  # Detectado automaticamente (ver find_vosk_model())

SAMPLE_RATE = 16000          # Hz — padrão VOSK
CHUNK_DURATION_S = 30        # Segundos de áudio capturado por ciclo
CHUNK_BYTES = SAMPLE_RATE * 2 * CHUNK_DURATION_S  # 16-bit mono = 2 bytes/sample
CHECK_INTERVAL_S = 15        # Intervalo entre checagens por estação
CONFIG_REFRESH_S = 300       # Atualiza config do SAAS a cada 5 minutos
SNIPPET_BEFORE_S = 10        # Segundos de contexto antes da keyword
SNIPPET_AFTER_S = 10         # Segundos de contexto depois da keyword

# Fuso de Brasília
BRASILIA_TZ = timezone(timedelta(hours=-3))

# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("monitor.log", encoding="utf-8"),
    ],
)
log = logging.getLogger("radio-monitor")

# ── Funções auxiliares ─────────────────────────────────────────────────────

def load_config() -> dict:
    """Carrega config.json local."""
    if not CONFIG_FILE.exists():
        log.error(f"config.json não encontrado em {CONFIG_FILE}")
        sys.exit(1)
    with open(CONFIG_FILE, encoding="utf-8") as f:
        return json.load(f)


def find_vosk_model() -> str:
    """Procura automaticamente a pasta do modelo VOSK PT-BR."""
    candidates = [
        "vosk-model-small-pt-0.3",
        "vosk-model-pt-fb-v0.1.1-20220516_2113",
        "vosk-model-pt",
        "vosk-model-small-pt",
    ]
    base = Path(__file__).parent
    for name in candidates:
        p = base / name
        if p.exists() and p.is_dir():
            log.info(f"Modelo VOSK encontrado: {p}")
            return str(p)
    # Tenta qualquer pasta começando com vosk-model
    for p in base.iterdir():
        if p.is_dir() and p.name.startswith("vosk-model"):
            log.info(f"Modelo VOSK encontrado: {p}")
            return str(p)
    log.error("Modelo VOSK PT-BR não encontrado. Baixe em:")
    log.error("  wget https://alphacephei.com/vosk/models/vosk-model-small-pt-0.3.zip")
    log.error("  unzip vosk-model-small-pt-0.3.zip")
    sys.exit(1)


def fetch_saas_config(saas_url: str, secret: str) -> dict:
    """
    Busca estações e palavras-chave ativas do LHFEX SAAS.
    Retorna: { stations: [...], keywords: [...] }
    """
    try:
        resp = requests.get(
            f"{saas_url}/api/radio-monitor-config",
            headers={"x-radio-monitor-key": secret},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        log.info(
            f"Config SAAS: {len(data.get('stations', []))} estações, "
            f"{len(data.get('keywords', []))} keywords"
        )
        return data
    except Exception as e:
        log.warning(f"Erro ao buscar config do SAAS: {e}")
        return {}


def post_event(saas_url: str, secret: str, payload: dict) -> bool:
    """
    Envia evento de detecção para o SAAS (que notifica o Telegram).
    """
    try:
        resp = requests.post(
            f"{saas_url}/api/radio-monitor-event",
            headers={
                "x-radio-monitor-key": secret,
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=15,
        )
        resp.raise_for_status()
        log.info(f"Evento enviado ao SAAS: {payload.get('detectedKeywords')}")
        return True
    except Exception as e:
        log.warning(f"Erro ao enviar evento ao SAAS: {e}")
        return False


def capture_stream_wav(stream_url: str, duration_s: int = CHUNK_DURATION_S) -> bytes | None:
    """
    Captura `duration_s` segundos do stream de rádio via ffmpeg.
    Retorna bytes WAV (16kHz, mono, 16-bit) ou None em caso de falha.
    """
    cmd = [
        "ffmpeg",
        "-loglevel", "quiet",
        "-y",                          # sobrescreve sem perguntar
        "-i", stream_url,              # stream de entrada
        "-t", str(duration_s),         # duração
        "-ar", str(SAMPLE_RATE),       # sample rate
        "-ac", "1",                    # mono
        "-f", "wav",                   # formato saída
        "pipe:1",                      # saída para stdout
    ]
    try:
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            timeout=duration_s + 15,
        )
        if result.returncode == 0 and len(result.stdout) > 1000:
            return result.stdout
        log.warning(f"ffmpeg retornou vazio para {stream_url}")
        return None
    except subprocess.TimeoutExpired:
        log.warning(f"Timeout ao capturar {stream_url}")
        return None
    except FileNotFoundError:
        log.error("ffmpeg não encontrado. Instale com: sudo apt install ffmpeg -y")
        sys.exit(1)
    except Exception as e:
        log.warning(f"Erro ao capturar stream {stream_url}: {e}")
        return None


def transcribe_wav(wav_bytes: bytes, recognizer: KaldiRecognizer) -> str:
    """
    Transcreve bytes WAV usando VOSK.
    Retorna texto transcrito (minúsculas).
    """
    # VOSK espera PCM raw sem header — pula os primeiros 44 bytes (header WAV)
    pcm_data = wav_bytes[44:]

    chunk_size = 4000  # bytes por chunk
    text_parts = []

    for i in range(0, len(pcm_data), chunk_size):
        chunk = pcm_data[i : i + chunk_size]
        if recognizer.AcceptWaveform(chunk):
            result = json.loads(recognizer.Result())
            if result.get("text"):
                text_parts.append(result["text"])

    # Captura resultado final
    final = json.loads(recognizer.FinalResult())
    if final.get("text"):
        text_parts.append(final["text"])

    return " ".join(text_parts).lower().strip()


def detect_keywords(text: str, keywords: list[dict]) -> list[dict]:
    """
    Procura palavras-chave no texto transcrito.
    Retorna lista de keywords encontradas (com metadados).
    Normaliza acentos e maiúsculas para comparação.
    """
    import unicodedata

    def normalize(s: str) -> str:
        s = s.lower()
        # Remove acentos
        s = unicodedata.normalize("NFD", s)
        s = "".join(c for c in s if unicodedata.category(c) != "Mn")
        return s

    text_norm = normalize(text)
    found = []
    for kw in keywords:
        kw_norm = normalize(kw["keyword"])
        if kw_norm in text_norm:
            found.append(kw)

    return found


def brasilia_now() -> datetime:
    """Retorna datetime atual no fuso de Brasília."""
    return datetime.now(tz=BRASILIA_TZ)


def brasilia_iso() -> str:
    """Retorna ISO 8601 no fuso de Brasília."""
    return brasilia_now().isoformat()


# ── Loop de monitoramento ──────────────────────────────────────────────────

class RadioMonitor:
    def __init__(self):
        self.config = load_config()
        self.saas_url = self.config["saas_url"].rstrip("/")
        self.secret = self.config["radio_monitor_secret"]
        self.saas_data = {}
        self.last_config_fetch = 0
        self.running = True

        # Carrega modelo VOSK
        model_path = find_vosk_model()
        log.info(f"Carregando modelo VOSK de {model_path}...")
        self.model = Model(model_path)
        log.info("Modelo VOSK carregado.")

    def refresh_config(self, force: bool = False):
        """Atualiza config do SAAS se passaram CONFIG_REFRESH_S segundos."""
        now = time.time()
        if force or (now - self.last_config_fetch) >= CONFIG_REFRESH_S:
            self.saas_data = fetch_saas_config(self.saas_url, self.secret)
            self.last_config_fetch = now

    def monitor_station(self, station: dict, keywords: list[dict]):
        """Monitora uma estação: captura → transcreve → detecta → notifica."""
        name = station["name"]
        url = station.get("streamUrl")
        if not url:
            log.warning(f"[{name}] Sem streamUrl — pulando")
            return

        log.info(f"[{name}] Capturando {CHUNK_DURATION_S}s do stream...")
        wav_bytes = capture_stream_wav(url, CHUNK_DURATION_S)
        if not wav_bytes:
            log.warning(f"[{name}] Falha ao capturar áudio")
            return

        # Cria novo recognizer para cada captura (VOSK é stateful)
        recognizer = KaldiRecognizer(self.model, SAMPLE_RATE)
        recognizer.SetWords(True)

        log.info(f"[{name}] Transcrevendo...")
        text = transcribe_wav(wav_bytes, recognizer)

        if not text:
            log.info(f"[{name}] Transcrição vazia")
            return

        log.info(f"[{name}] Transcrição: {text[:120]}...")

        # Detecta keywords
        found = detect_keywords(text, keywords)
        if not found:
            return

        found_names = [k["keyword"] for k in found]
        confidence = min(100, len(found) * 30 + 40)  # heurística simples
        detected_at = brasilia_iso()

        log.info(f"[{name}] 🔑 KEYWORDS DETECTADAS: {found_names}")

        # Envia para o SAAS (que salva no banco e notifica Telegram)
        payload = {
            "stationId": station["id"],
            "stationName": name,
            "transcriptionText": text,
            "detectedKeywords": found_names,
            "confidence": confidence,
            "detectedAt": detected_at,
        }
        post_event(self.saas_url, self.secret, payload)

    def run(self):
        """Loop principal — monitora todas as estações em paralelo."""
        log.info("=" * 60)
        log.info("LHFEX Radio Monitor iniciado")
        log.info(f"SAAS: {self.saas_url}")
        log.info("=" * 60)

        # Busca config inicial
        self.refresh_config(force=True)

        while self.running:
            stations = self.saas_data.get("stations", [])
            keywords = self.saas_data.get("keywords", [])

            if not stations:
                log.warning("Nenhuma estação ativa. Aguardando...")
                time.sleep(CHECK_INTERVAL_S)
                self.refresh_config()
                continue

            if not keywords:
                log.warning("Nenhuma keyword ativa. Aguardando...")
                time.sleep(CHECK_INTERVAL_S)
                self.refresh_config()
                continue

            log.info(
                f"Monitorando {len(stations)} estação(ões) | "
                f"{len(keywords)} keyword(s): {[k['keyword'] for k in keywords]}"
            )

            # Processa cada estação sequencialmente
            # (em VMs com 1 CPU, sequencial é mais estável)
            for station in stations:
                if not self.running:
                    break
                try:
                    self.monitor_station(station, keywords)
                except Exception as e:
                    log.error(f"[{station['name']}] Erro inesperado: {e}")

            # Aguarda intervalo e atualiza config
            log.info(f"Aguardando {CHECK_INTERVAL_S}s antes do próximo ciclo...")
            time.sleep(CHECK_INTERVAL_S)
            self.refresh_config()

        log.info("Monitor encerrado.")

    def stop(self):
        self.running = False


# ── Entrypoint ─────────────────────────────────────────────────────────────

def main():
    monitor = RadioMonitor()

    # Graceful shutdown com Ctrl+C ou SIGTERM
    def handle_signal(sig, frame):
        log.info("Sinal recebido — encerrando...")
        monitor.stop()

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    monitor.run()


if __name__ == "__main__":
    main()
