FROM node:22-slim
# node:22-slim (Debian) é necessário porque openclaw depende de node-llama-cpp,
# que requer binários pré-compilados disponíveis para Debian/Ubuntu mas NÃO para Alpine.
#
# Versão pinada para evitar breaking changes em updates automáticos.
# Para atualizar: checar changelog em npmjs.com/package/openclaw, testar com
# "openclaw doctor", depois atualizar a versão aqui e fazer Redeploy.

# ── Escrever .gitconfig ANTES de instalar o git ──────────────────────────────
# @whiskeysockets/baileys (dep do clawhub) define libsignal-node como
# git+ssh://github.com URL — sem isso o npm install falha com exit 128.
# Escrever o arquivo direto evita qualquer problema de escaping no shell.
RUN printf '[url "https://github.com/"]\n    insteadOf = ssh://git@github.com/\n    insteadOf = git+ssh://git@github.com/\n    insteadOf = git://github.com/\n[user]\n    email = openclaw@lhfex.com.br\n    name = OpenClaw LHFEX\n' > /root/.gitconfig

# ── Instalar dependências + packages ─────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
        git openssh-client \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g openclaw@2026.2.26 clawhub

WORKDIR /root/.openclaw
COPY openclaw.json ./
COPY prompts/ ./prompts/
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh
VOLUME ["/root/.openclaw/workspace", "/root/.openclaw/memory"]
EXPOSE 18789
CMD ["./entrypoint.sh"]
