# Cutover Checklist - Hermes Agent LHFEX

## Antes de desligar o OpenClaw

- [ ] `hermes version` responde no VPS
- [ ] `hermes status` mostra DeepSeek como primario e OpenRouter como fallback
- [ ] `hermes claw migrate --dry-run` passou sem erro estrutural
- [ ] `~/.hermes/SOUL.md` foi sobrescrito pelo arquivo LHFEX
- [ ] `~/.hermes/skills/lhfex-saas/SKILL.md` existe
- [ ] `~/.hermes/skills/lhfex-runtime/SKILL.md` existe
- [ ] `~/.hermes/skills/lhfex-squad-router/SKILL.md` existe
- [ ] `hermes gateway install` foi executado
- [ ] o servico do gateway Hermes esta parado

## Testes obrigatorios por CLI

- [ ] consulta simples ao modelo principal funciona
- [ ] fallback OpenRouter foi validado
- [ ] chamada ao SaaS `catalogo_acoes` funciona
- [ ] `buscar_clientes` funciona
- [ ] `resumo_processos` funciona
- [ ] `google_status` responde sem inventar conexao
- [ ] pergunta sobre provider/modelo responde com `hermes status` real
- [ ] pergunta sobre acesso ao SaaS confirma o acesso ativo sem pedir variaveis ja configuradas

## Durante o cutover

- [ ] OpenClaw antigo parado
- [ ] Hermes gateway iniciado
- [ ] DM do Luiz responde
- [ ] grupo autorizado responde
- [ ] usuario nao autorizado e negado
- [ ] comando perigoso pede aprovacao

## Pos-cutover imediato

- [ ] criar cliente por CNPJ
- [ ] abrir processo por cliente + modal
- [ ] atualizar processo por referencia
- [ ] listar assinaturas
- [ ] consultar promocoes
- [ ] registrar evidencias no changelog operacional

## Rollback se qualquer item falhar

- [ ] parar Hermes gateway
- [ ] reativar OpenClaw antigo
- [ ] confirmar resposta do bot
- [ ] manter Hermes parado para ajuste posterior
