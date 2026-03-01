FROM node:22-slim
# node:22-slim (Debian) é necessário porque openclaw depende de node-llama-cpp,
# que requer binários pré-compilados Debian/Ubuntu (Alpine usa musl libc sem cmake).
#
# Versão pinada. Para atualizar: ver npmjs.com/package/openclaw, testar
# "openclaw doctor", atualizar a versão aqui e fazer Redeploy.

# HOME explícito garante que git encontra /root/.gitconfig
ENV HOME=/root

# Desabilita git config do sistema (/etc/gitconfig) que pode sobrepor o nosso.
# O config em ~/.gitconfig (copiado abaixo) ainda é lido normalmente.
ENV GIT_CONFIG_NOSYSTEM=1

# Copia gitconfig com regras insteadOf antes de instalar qualquer coisa.
# COPY garante que o arquivo está 100% correto (sem risco de escaping de shell).
# Regras: redireciona URLs SSH/git do GitHub para HTTPS durante o npm install.
# (@whiskeysockets/baileys@7.0.0-rc.9 tem dep git+https:// para libsignal-node)
COPY gitconfig /root/.gitconfig

RUN apt-get update && apt-get install -y --no-install-recommends \
        git openssh-client \
    && rm -rf /var/lib/apt/lists/* \
    && echo "=== git config global ===" \
    && git config --global --list \
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
