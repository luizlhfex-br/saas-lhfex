# OpenClaw — Histórico de Upgrades

> Este arquivo lista as melhorias que você (OpenClaw) recebeu.
> Quando Luiz perguntar "o que você sabe fazer?" ou "quais foram as últimas melhorias?",
> leia este arquivo antes de responder.

---

## v2.3.0 — 2026-03-04 (deploy mais recente)

### Melhorias em você (OpenClaw):
- ✅ **Hierarquia de 4 camadas** de modelos:
  - Camada 1: Gemini 2.0 Flash (grátis, primário)
  - Camada 2: OpenRouter /auto (grátis, router automático)
  - Camada 3: DeepSeek direto (pago, tokens já comprados)
  - Camada 4: Kimi K2.5 via OpenRouter (econômico)
- ✅ **7 cron jobs ativos**: update-check, vps-daily, personal-morning, morning-brief, lhfex-weekly, promotions-checker, process-alerts-pm
- ✅ **Transcrição de áudio** via Groq Whisper (whisper-large-v3-turbo) quando Luiz envia voz no Telegram
- ✅ **Análise de imagens** via Gemini Vision 2.0 Flash quando Luiz envia foto
- ✅ **SOUL.md atualizado**: regra absoluta de honestidade, quiet hours 00h-05h
- ✅ **SAAS API**: OPENCLAW_TOOLS_API_KEY e SAAS_URL já configurados — use diretamente
- ✅ **Memória avançada**: flush 40k tokens, TTL 6h, busca híbrida BM25+vector, últimas 3 respostas sempre ativas
- ✅ **Rodapé de modelo**: adicionar `— 🤖 gemini-2.0-flash · Camada 1 (grátis)` ao final das respostas
- ✅ **Workspace estruturado**: `/workspace/memory/` com arquivos por categoria (decisions, projects, people, lessons, pending)

### Melhorias no SAAS (para você consultar via API):
- ✅ Dia Limpo: tracker de streak pessoal (grid estilo GitHub)
- ✅ Dashboard: cotação PTAX BCB com data de atualização
- ✅ Faturamento: template profissional + envio por email
- ✅ Changelog: `/changelog` na sidebar do SAAS (AI & Automation)

---

## v2.2.0 — 2026-02-26

- ✅ Container Docker lançado no Coolify (porta 18789)
- ✅ Telegram integrado com Gemini 2.0 Flash
- ✅ Heartbeat a cada 15 min verificando WORKING.md
- ✅ Backup automático de memória no GitHub (branch openclaw-memory)
- ✅ Morning brief (8h) e alertas PM (18h)
- ✅ SOUL.md, IDENTITY.md, USER.md, AGENTS.md no workspace
- ✅ SAAS API com 12+ ações (criar_cliente, abrir_processo, etc.)

---

## Capacidades Ativas Agora

| Capacidade | Status |
|---|---|
| Conversa via Gemini 2.0 Flash | ✅ Ativo |
| Transcrição de áudio (Groq Whisper) | ✅ Ativo (requer GROQ_API_KEY) |
| Análise de imagens (Gemini Vision) | ✅ Ativo |
| Pesquisa na web (web-search + web_fetch) | ✅ Ativo |
| SAAS API (criar clientes, processos, etc.) | ✅ Ativo |
| 7 cron jobs agendados | ✅ Ativo |
| Memória com busca BM25+vector | ✅ Ativo |
| Backup GitHub automático | ✅ Ativo (requer GITHUB_BACKUP_TOKEN) |
| Coolify (acesso direto) | ❌ Não disponível |
| Token usage em tempo real | ❌ Não implementado ainda |
