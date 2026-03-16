# OpenClaw - Historico de Upgrades

> Este arquivo lista as melhorias que o OpenClaw recebeu.
> Quando Luiz perguntar "o que voce sabe fazer?" ou "quais foram as ultimas melhorias?",
> leia este arquivo antes de responder.

---

## v2.9.15 - 2026-03-16

### Melhorias em voce (OpenClaw)
- Fallback gratuito do gateway saiu do slug fixo quebrado do Qwen e passou para `openrouter/free`
- O roteador free da OpenRouter agora escolhe automaticamente um modelo gratuito disponivel em runtime
- Mensagens do Telegram e documentacao do gateway foram alinhadas com a cadeia real: Vertex Gemini -> OpenRouter Free -> DeepSeek Direct

---

## v2.9.10 - 2026-03-15

### Melhorias em voce (OpenClaw)
- Runtime atualizado para OpenClaw `2026.3.13`
- Dockerfile do gateway alinhado para instalar `openclaw@2026.3.13`
- Mensagem de deploy do Telegram e status exposto pela API do SaaS passaram a refletir a nova versao
- Validacao operacional previa confirmou que `openclaw@2026.3.13` instala corretamente sobre `node:22-slim` com `git` e `ca-certificates`

---

## v2.9.2 - 2026-03-14 (deploy alvo atual)

### Melhorias em voce (OpenClaw)
- 8 agentes especialistas ativos com workspaces dedicados: AIrton, IAna, marIA, IAgo, IAra, SofIA, mAI e JULia
- Nova cadeia de modelos:
  - Primario: Vertex Gemini 2.0 Flash
  - Fallback 1: OpenRouter Free Router
  - Ultimo recurso: DeepSeek Direct
- Skills locais novas: `lhfex-comex-expert`, `lhfex-licitacoes` e `lhfex-promocoes`
- Cron de update check toda segunda 9h BRT com pedido de autorizacao antes de atualizar
- SOUL.md reforcado: autonomia com excecoes para delete, deploy, migrations e outras acoes irreversiveis
- Escopo financeiro em modo leitura: pode consultar extrato, cotacoes e DRE, mas nao executar pagamentos
- Idioma padrao PT-BR e carga de contexto completo uma vez por sessao

### Melhorias no SaaS para voce consultar via API
- `/subscriptions` com CRUD de assinaturas, totais em BRL/USD e endpoint `ver_assinaturas`
- `/squad` com a Pixel Room dos 9 agentes
- Radio Monitor com site, telefone e WhatsApp nas radios
- Migration `0009_amusing_celestials` aplicada em producao: `subscriptions` criada, `radio_stations` expandida e `ai_usage_logs.provider` migrado para `varchar`

---

## v2.9.5 - 2026-03-14

### Melhorias em voce (OpenClaw)
- CRM operacional: `criar_cliente` agora aceita apenas CNPJ e tenta enriquecer os dados automaticamente
- Processos operacionais: `abrir_processo` agora aceita cliente + modal, com `import` como padrao quando o tipo nao vier explicito
- Novo endpoint `atualizar_processo` para atualizar processo por referencia com status, observacoes e campos operacionais
- Erros de ambiguidade e duplicidade passam a retornar detalhes estruturados para voce desambiguar com respostas curtas

---

## v2.9.0 - 2026-03-14

- OpenClaw multiagente configurado com 8 identidades especializadas e workspaces dedicados
- SAAS skill, SOUL.md, AGENTS.md e entrypoint reescritos sem segredos hardcoded
- Cron de update check alinhado para segunda-feira 9h BRT
- Integracao com a nova chain do SaaS: Vertex Gemini -> OpenRouter Free -> DeepSeek Direct

---

## v2.3.0 - 2026-03-04

- Hierarquia anterior de 4 camadas com Gemini, OpenRouter e DeepSeek
- 7 cron jobs ativos na operacao inicial
- Transcricao de audio via Groq Whisper
- Analise de imagens via Gemini Vision
- SAAS API acessivel por `OPENCLAW_TOOLS_API_KEY` e `SAAS_URL`

---

## Capacidades Ativas Agora

| Capacidade | Status |
|---|---|
| Conversa multiagente | Ativo |
| Vertex Gemini 2.0 Flash | Ativo |
| OpenRouter Free Router | Ativo |
| DeepSeek Direct | Ativo |
| Transcricao de audio (Groq Whisper) | Ativo quando `GROQ_API_KEY` existir |
| Analise de imagens | Ativo |
| SAAS API | Ativo |
| Cron de update check | Ativo |
| Backup GitHub de memoria | Ativo quando `GITHUB_BACKUP_TOKEN` existir |
| Pagamentos/acoes financeiras irreversiveis | Bloqueado |
