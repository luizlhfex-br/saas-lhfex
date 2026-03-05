# IDEAS — Backlog de Ideias Futuras LHFEX
> Alimentado continuamente. Última atualização: 2026-03-05

---

## 🤖 OpenClaw / AI

### Camoufox (Anti-bot Browser)
- https://github.com/daijro/camoufox
- Fork do Firefox com fingerprint anti-detecção
- Usar se OpenClaw bater CAPTCHA em SISCOMEX, RF, MDIC
- Config: `browser.executablePath` no openclaw.json

### OpenClaw Update (v2026.2.26 → v2026.3.x)
- Atualizar via terminal do container: `openclaw update`
- OU atualizar base image no Dockerfile e redeploy
- Verificar changelog antes (possíveis breaking changes)

### Groq Whisper para Audio no OpenClaw
- OpenClaw gateway recebe voice do Telegram mas não transcreve
- Fix: skill customizada que chama Groq Whisper via exec/web_fetch
- GROQ_API_KEY já existe no container
- Endpoint: POST https://api.groq.com/openai/v1/audio/transcriptions

### Gemini Flash Lite (Otimização de Custo)
- Flash-Lite 2.0: 25% mais barato no tier pago, mesma velocidade no free
- Usar para AIrton/IAgo (queries simples) e manter Flash 2.0 para IAna/marIA
- Mudança: alterar model ID em ai.server.ts + openclaw.json

### DeepSeek Reasoner para NCM Complexo
- deepseek/deepseek-reasoner (via OpenRouter)
- Para classificações NCM ambíguas com raciocínio multi-etapas
- Adicionar como opção `forceProvider: "deepseek-reasoner"` no askAgent

### Skills ClawhHub — Considerar Depois
- **Proactive Agent** (55k downloads) — autonomia total + WAL Protocol + crons próprios
- **Gog** (82k) — Gmail, Calendar, Drive, Sheets para automação de email de comex
- **Agent Browser** (67k) — browser Rust ultra-rápido, alternativa ao Playwright
- **ByteRover** (24k) — banco de conhecimento persistente para contexto histórico
- **Nano PDF** (36k) — edição de PDFs com linguagem natural
- **API Gateway** (33k, 59 versões) — conecta 100+ APIs (HubSpot, Airtable, LinkedIn)
- **Skill Creator** (24k) — criar skills personalizadas para LHFEX
- **YouTube Watcher** (23k) — transcrever vídeos de treinamento/regulatório

### Jina AI MCP Server
- https://github.com/jina-ai/MCP
- Alternativa à chamada direta via web_fetch
- Instalar via mcporter skill: mais integrado ao OpenClaw

### Tavily MCP Server
- https://mcp.tavily.com/mcp/?tavilyApiKey=API_KEY
- Remote MCP server, alternativa à skill ClawhHub
- Instalar via mcporter para ter tool nativa `tavily_search`

---

## 🏗️ SAAS / Infraestrutura

### Migrar para OpenClaw como Único Bot Telegram
- Eliminar api.telegram-webhook.tsx
- OpenClaw vira único bot com todos os dados do SAAS via API
- Dependência: 100% acesso ao SAAS (em implementação)

### Uptime Kuma / UptimeRobot
- Registrar https://saas.lhfex.com.br/api/monitor-openclaw
- Alertas automáticos a cada 5 minutos
- Endpoint já existe, só precisa registrar externamente

### OpenClaw Webhook Mode (vs Long Polling)
- Atualmente: long polling (padrão, bom para baixo volume)
- Webhook mode: mais eficiente para >100 msgs/dia
- Config: webhookUrl, webhookSecret no openclaw.json

### Alibaba Cloud
- $3 primeiro mês, $10/mês depois
- Avaliar para hospedar serviços complementares
- Verificar Qwen models via OpenRouter como LLM fallback

### Ollama Local
- Rodar modelos localmente no servidor do Coolify
- Evitar custo de API para queries internas frequentes
- Considerar quando custo mensal de APIs superar $30

---

## 💡 Features de Negócio

### Dashboard Câmbio em Tempo Real
- Widget na tela inicial com USD/BRL atualizado a cada 5min
- Fonte: economia.awesomeapi.com.br (grátis, sem key)

### Alertas de Vencimento de Promoções
- Cron diário: verificar promotions com endDate < 7 dias
- Enviar alerta no Telegram com link direto para participar
- Implementar como job no OpenClaw entrypoint.sh

### Relatório Semanal Automatizado
- Toda segunda-feira 9h: resumo da semana anterior
- Processos abertos/fechados, câmbio médio, promoções, tarefas concluídas
- OpenClaw gera e envia no Telegram

### Groq para SAAS Webhook (melhorar transcrição)
- Atual: transcrição funcionando no SAAS webhook (api.telegram-webhook.tsx)
- Pendente: verificar se GROQ_API_KEY foi adicionada ao saas-lhfex env vars
- Modelo: whisper-large-v3-turbo ($0.04/hora de áudio)

### NCM com Reasoning (DeepSeek Reasoner)
- Para classificações complexas, chamar deepseek-reasoner
- Gera justificativa completa com referências legais
- Integrar como opção premium na IAna
