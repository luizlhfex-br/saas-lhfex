# Próximas Ondas — Ordem de Prioridade Operacional

## Regra aplicada

1. Coisas que o agente faz sozinho e rápido
2. Coisas que o agente faz tudo sozinho
3. Coisas que precisam da sua ação

---

## 1) Sozinho e rápido (executadas agora)

- ✅ Remoção de artefatos legados de N8N na raiz do projeto.
- ✅ Script de smoke test de produção: `npm run ops:smoke-prod`.
- ✅ Script de auditoria de variáveis runtime para Coolify: `npm run ops:env-audit`.
- ✅ Organização formal desta priorização em documento único.

Objetivo: reduzir risco operacional imediato e acelerar validação pós-deploy.

---

## 2) Sozinho completo (executadas agora)

- ✅ Pipeline operacional de hardening local:
  - `ops:health-watchdog`
  - `ops:smoke-prod`
  - `ops:env-audit`
- ✅ Healthcheck de container já ativo (Dockerfile).
- ✅ Checklist de hardening Coolify consolidado em `docs/COOLIFY-HARDENING-CHECKLIST.md`.

Objetivo: deixar monitoramento + validação repetíveis sem depender de intervenção manual sua.

---

## 3) Dependem da sua ação (deixadas para depois)

### Onda 4c (bloqueador funcional)
- [ ] Rodar/confirmar migração interativa no ambiente alvo (`npm run db:push`) quando houver prompt de remoção de colunas.
- [ ] Validar fluxo real OAuth Google com conta final em produção.

### Coolify / produção
- [ ] Garantir variáveis sensíveis como **Runtime Only** no painel Coolify.
- [ ] Confirmar credenciais finais de produção (Redis/Sentry/Telegram, se faltarem).

### Integrações futuras
- [ ] Disponibilizar token Banco Inter quando for iniciar integração.
- [ ] Definir janela para ativar integrações oficiais NCM (Siscomex/TTCE/ComexStat).

---

## Próxima execução automática sugerida (quando você mandar)

- Iniciar Onda 6 (automações backend nativas) já sem N8N, começando por painel de automações + logs.
