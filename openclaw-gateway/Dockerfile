FROM node:22-alpine
# Versão pinada para evitar breaking changes em updates automáticos
# Para atualizar: checar changelog em npmjs.com/package/openclaw, testar com
# "openclaw doctor", depois atualizar a versão aqui e fazer Redeploy
RUN apk add --no-cache git openssh-client python3 make g++ && \
    npm install -g openclaw@2026.2.26 clawhub && \
    apk del python3 make g++ && \
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
