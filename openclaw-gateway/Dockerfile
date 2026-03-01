FROM node:22-slim
# node:22-slim (Debian) é necessário porque openclaw depende de node-llama-cpp,
# que requer binários pré-compilados Debian/Ubuntu (Alpine usa musl libc sem cmake).
#
# Versão pinada. Para atualizar: ver npmjs.com/package/openclaw, testar
# "openclaw doctor", atualizar a versão aqui e fazer Redeploy.

# HOME explícito garante que git encontra /root/.gitconfig
ENV HOME=/root

# Desabilita git config do sistema (/etc/gitconfig).
ENV GIT_CONFIG_NOSYSTEM=1

# GIT_CONFIG_COUNT/KEY_n/VALUE_n: máxima prioridade (git 2.32+).
# Sobrepõe system, global E qualquer env injetado pelo Coolify.
# Redireciona SSH/git GitHub → HTTPS para npm install sem chaves SSH.
ENV GIT_CONFIG_COUNT=3 \
    GIT_CONFIG_KEY_0="url.https://github.com/.insteadof" \
    GIT_CONFIG_VALUE_0="ssh://git@github.com/" \
    GIT_CONFIG_KEY_1="url.https://github.com/.insteadof" \
    GIT_CONFIG_VALUE_1="git+ssh://git@github.com/" \
    GIT_CONFIG_KEY_2="url.https://github.com/.insteadof" \
    GIT_CONFIG_VALUE_2="git://github.com/"

# Copia gitconfig como fallback adicional.
COPY gitconfig /root/.gitconfig

RUN apt-get update && apt-get install -y --no-install-recommends \
        git ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && echo "=== git config list ===" \
    && git config --list \
    && echo "=== test url rewrite: ssh→https ===" \
    && git ls-remote ssh://git@github.com/WhiskeySockets/libsignal-node.git HEAD \
    && echo "=== npm install ===" \
    && npm install -g openclaw@2026.2.26 clawhub

WORKDIR /root/.openclaw
COPY openclaw.json ./
COPY prompts/ ./prompts/
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh
VOLUME ["/root/.openclaw/workspace", "/root/.openclaw/memory"]
EXPOSE 18789
CMD ["./entrypoint.sh"]
