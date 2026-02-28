FROM node:22-slim
# node:22-slim (Debian) é necessário porque openclaw depende de node-llama-cpp,
# que requer binários pré-compilados disponíveis para Debian/Ubuntu mas NÃO para Alpine.
# Alpine usa musl libc e não tem cmake — causava "Failed to build llama.cpp: cmake not found".
#
# Versão pinada para evitar breaking changes em updates automáticos.
# Para atualizar: checar changelog em npmjs.com/package/openclaw, testar com
# "openclaw doctor", depois atualizar a versão aqui e fazer Redeploy.
RUN apt-get update && apt-get install -y --no-install-recommends \
        git openssh-client \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g openclaw@2026.2.26 clawhub \
    && git config --global user.email "openclaw@lhfex.com.br" \
    && git config --global user.name "OpenClaw LHFEX"
WORKDIR /root/.openclaw
COPY openclaw.json ./
COPY prompts/ ./prompts/
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh
VOLUME ["/root/.openclaw/workspace", "/root/.openclaw/memory"]
EXPOSE 18789
CMD ["./entrypoint.sh"]
