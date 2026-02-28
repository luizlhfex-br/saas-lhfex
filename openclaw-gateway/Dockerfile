FROM node:22-alpine
# Versão pinada para evitar breaking changes em updates automáticos
# Para atualizar: checar changelog em npmjs.com/package/openclaw, testar com
# "openclaw doctor", depois atualizar a versão aqui e fazer Redeploy
RUN apk add --no-cache git openssh-client && \
    npm install -g openclaw@2026.2.26 clawhub --ignore-scripts && \
    git config --global user.email "openclaw@lhfex.com.br" && \
    git config --global user.name "OpenClaw LHFEX"
WORKDIR /root/.openclaw
COPY openclaw.json ./
COPY prompts/ ./prompts/
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh
VOLUME ["/root/.openclaw/workspace", "/root/.openclaw/memory"]
EXPOSE 18789
CMD ["./entrypoint.sh"]
