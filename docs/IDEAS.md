# IDEAS - Backlog Curado
> Ultima atualizacao: 2026-03-14

---

## IA / OpenClaw

### Edge-TTS no Telegram
- Responder com audio em PT-BR alem de texto
- Bom para briefings, resumos e respostas longas
- Dependencia operacional: instalar `edge-tts` no container e criar wrapper seguro

### Camoufox / browser anti-bot
- Usar so se Playwright comum comecar a falhar em portais mais fechados
- Prioridade baixa ate aparecer caso real

### ByteRover ou memoria mais forte
- Considerar apenas se a memoria atual do OpenClaw ficar curta para contexto historico

---

## SaaS / Infra

### Bot unico
- Avaliar no futuro se faz sentido apos maturar o OpenClaw como operador do SaaS
- Hoje ainda faz sentido manter webhook principal e OpenClaw separados

### Uptime externo
- Registrar health endpoints no Uptime Kuma / UptimeRobot
- Falta só operacionalizar fora do repo

### Webhook mode para OpenClaw
- Considerar se o volume do Telegram crescer o suficiente para justificar

### Endurecimento de repositorio e segredos
- Tornar o repositorio privado, mas so depois de confirmar que o Coolify continua autenticado para clonar o repo privado
- Sanitizar mais documentos operacionais que ainda descrevem demais a infra e os fluxos internos
- Rotacionar segredos expostos por superfícies publicas antigas, principalmente OPENCLAW_TOOLS_API_KEY e tokens de bot, com janela de troca planejada para nao derrubar integracoes

---

## Produto

### AI Usage mais executivo
- Custo estimado por provider
- Volume por agente
- Historico por periodo

### Financeiro
- Conciliacao mais automatica
- Melhor ingestao de extratos

### Mobile
- App leve para consulta e alerta

---

## Removido do backlog ativo

- ideias ja implementadas
- chain antiga com `openrouter_paid`
- migracao apressada para bot unico
- itens sem dono tecnico claro
