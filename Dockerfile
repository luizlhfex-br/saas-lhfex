FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN NODE_ENV=development npm ci --legacy-peer-deps

COPY . .
RUN npm run build
RUN npm prune --omit=dev --legacy-peer-deps

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
	CMD wget -qO- http://127.0.0.1:3000/api/health | grep -q '"status":"ok"' || exit 1
CMD ["npm", "run", "start"]
