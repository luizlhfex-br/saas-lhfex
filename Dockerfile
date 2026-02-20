FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN NODE_ENV=development npm ci --legacy-peer-deps

COPY . .
RUN npm run build
RUN npm prune --omit=dev --legacy-peer-deps

EXPOSE 3000
CMD ["npm", "run", "start"]
