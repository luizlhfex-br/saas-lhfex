# IDEAS — Backlog de Ideias Futuras LHFEX
> Alimentado continuamente. Ultima atualizacao: 2026-03-11

---

## 🤖 OpenClaw / AI

### Edge-TTS — Respostas em Audio no Telegram ⭐ PRIORIDADE
- Fonte: analise do projeto SandeClaw (github.com/sandeco/prompts/SandeClaw)
- Microsoft Edge TTS gratuito, qualidade natural, multiplas vozes pt-BR
- Permitiria o bot OpenClaw responder com audio alem de texto
- Implementacao: skill customizada ou exec que chama edge-tts CLI
- Instalacao: `pip install edge-tts` no container + script wrapper
- Vozes recomendadas: `pt-BR-AntonioNeural` (masc), `pt-BR-FranciscaNeural` (fem)
- Caso de uso: resumos longos, relatorios, briefings matinais em audio
- Referencia: SandeClaw usava edge-tts + Whisper STT para loop completo voz-a-voz

### Ideias Aproveitadas do SandeClaw (NAO criar projeto, roubar ideias)
- **Hot-reload de skills YAML**: ClawhHub ja faz isso, mas formato YAML do SandeClaw e mais limpo para skills customizadas
- **ReAct pattern explicito**: OpenClaw ja implementa internamente, mas documentar como referencia para Skills 2.0
- **Memory window (N ultimas msgs)**: OpenClaw ja tem compaction + contextPruning configurados
- **Factory pattern para LLMs**: ja implementado em ai.server.ts com providerCallMap
- **Decisao final**: SandeClaw NAO vale criar — OpenClaw ja faz tudo e mais (crons, browser, 50+ skills, multi-agente)

### Camoufox (Anti-bot Browser)
- https://github.com/daijro/camoufox
- Fork do Firefox com fingerprint anti-detecao
- Usar se OpenClaw bater CAPTCHA em SISCOMEX, RF, MDIC
- Config: `browser.executablePath` no openclaw.json

### Groq Whisper para Audio no OpenClaw
- OpenClaw gateway recebe voice do Telegram mas nao transcreve
- Fix: skill customizada que chama Groq Whisper via exec/web_fetch
- GROQ_API_KEY ja existe no container
- Endpoint: POST https://api.groq.com/openai/v1/audio/transcriptions

### Gemini Flash Lite (Otimizacao de Custo)
- Flash-Lite 2.0: 25% mais barato no tier pago, mesma velocidade no free
- Usar para queries simples (heartbeat, status) e manter Flash 2.0 para analises complexas
- Mudanca: alterar model ID em ai.server.ts + openclaw.json

### DeepSeek Reasoner para NCM Complexo
- deepseek/deepseek-reasoner (via OpenRouter)
- Para classificacoes NCM ambiguas com raciocinio multi-etapas
- Adicionar como opcao `forceProvider: "deepseek-reasoner"` no askAgent

### Skills ClawhHub — Considerar Depois
- **Proactive Agent** (55k downloads) — autonomia total + WAL Protocol + crons proprios
- **Gog** (82k) — Gmail, Calendar, Drive, Sheets para automacao de email de comex
- **Agent Browser** (67k) — browser Rust ultra-rapido, alternativa ao Playwright
- **ByteRover** (24k) — banco de conhecimento persistente para contexto historico
- **Nano PDF** (36k) — edicao de PDFs com linguagem natural
- **API Gateway** (33k, 59 versoes) — conecta 100+ APIs (HubSpot, Airtable, LinkedIn)
- **Skill Creator** (24k) — criar skills personalizadas para LHFEX
- **YouTube Watcher** (23k) — transcrever videos de treinamento/regulatorio

### Jina AI MCP Server
- https://github.com/jina-ai/MCP
- Alternativa a chamada direta via web_fetch
- Instalar via mcporter skill: mais integrado ao OpenClaw

### Tavily MCP Server
- https://mcp.tavily.com/mcp/?tavilyApiKey=API_KEY
- Remote MCP server, alternativa a skill ClawhHub
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
