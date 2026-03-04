# Skill: Diagnóstico Sistemático de Erros

> Consulte este arquivo quando um cron falhar, uma chamada de API retornar erro,
> ou qualquer operação automática não produzir o resultado esperado.

---

## Protocolo de 4 Fases (baseado em Systematic Debugging)

### FASE 1 — Identificação (O que falhou exatamente?)

Antes de qualquer ação, responda internamente:
1. **Qual job/ação falhou?** → nome do cron (ex: `morning-brief`), action chamada, tool usada
2. **Qual foi o erro exato?** → HTTP status, mensagem de exceção, timeout, resposta vazia
3. **Quando ocorreu?** → horário, se é a primeira vez ou recorrente
4. **Contexto:** → qual era o objetivo da ação que falhou?

**Nunca pule esta fase.** Diagnosticar sem identificar causa é pior que não diagnosticar.

---

### FASE 2 — Rastreamento da Causa Raiz

Use esta tabela para classificar o erro:

| Sintoma | Causa provável | Próximo passo |
|---------|---------------|---------------|
| HTTP 401 | API key inválida ou expirada | Testar `system_status` — se também der 401, notificar Luiz |
| HTTP 403 | Permissão negada (usuário sem acesso) | Verificar se OPENCLAW_TOOLS_API_KEY é a correta para este ambiente |
| HTTP 404 | URL errada ou rota não existe | Verificar SAAS_URL env var; testar URL manualmente |
| HTTP 429 | Rate limit atingido | Aguardar 60s, tentar uma vez; se persistir, notificar Luiz |
| HTTP 500 | Erro interno do servidor SAAS | Registrar em memory/lessons.md; notificar Luiz com corpo da resposta |
| Timeout (>30s) | SAAS fora do ar ou lento | Testar `system_status`; se offline, aguardar 15min antes de novo teste |
| Resposta vazia | Parsing falhou ou endpoint retornou `{}` | Logar resposta bruta; verificar se formato mudou |
| "NOT_FOUND" em skill | Skill não instalada ou nome errado | Verificar `clawhub list`; reinstalar se necessário |
| "Unknown config key" | Chave inválida no openclaw.json | Identificar a chave, removê-la, reportar ao Luiz |
| Cron não executou | Container reiniciado ou job desabilitado | Verificar logs do container; conferir `jobs.json` |

---

### FASE 3 — Regras de Contenção (nunca criar loops)

**Regra dos 3 tentativas:**
- Máximo **3 tentativas** para qualquer ação falhando
- Após 3 falhas: PARAR, registrar em `memory/lessons.md`, notificar Luiz
- **Nunca** repetir automaticamente a mesma chamada falhando sem intervalo

**Regra de silêncio inteligente:**
- Se o mesmo erro já foi notificado nas últimas **2 horas**: NÃO notificar novamente
- Se estiver em **quiet hours (00h-05h)**: registrar em memória, notificar na manhã
- Exceção: erros que indicam SAAS completamente offline — notificar sempre

**Regra de não-invenção:**
- Se não conseguiu executar a ação: diga que não conseguiu
- **Nunca** inventar o resultado que seria esperado
- **Nunca** simular sucesso de uma ação que falhou

---

### FASE 4 — Recuperação e Registro

**Se o erro é recuperável (transiente):**
```
1. Aguardar intervalo (60s para 429, 15min para timeout)
2. Tentar uma vez mais
3. Se resolveu: registrar em memory/lessons.md com solução
4. Se não resolveu: escalar para notificação ao Luiz
```

**Se o erro exige intervenção humana:**
```
Mensagem para Luiz (Telegram):
⚠️ [Job: nome_do_job]
Erro: [tipo e mensagem exata]
Tentativas: [N/3]
Última tentativa: [horário]
O que foi tentado: [lista]
Recomendação: [ação sugerida]
```

**Registro obrigatório em `memory/lessons.md`:**
```markdown
## [DATA] — Erro em [job/ação]
- Sintoma: [descrição]
- Causa raiz: [identificada ou 'desconhecida']
- Resolução: [o que funcionou ou 'aguardando Luiz']
- Prevenção futura: [como evitar]
```

---

## Erros Comuns Conhecidos (histórico)

### 2026-03-03 — `agents.defaults.quietHours` inválido
- **Sintoma:** Container reiniciando em loop ("Unknown config keys")
- **Causa:** OpenClaw não suporta `quietHours` no openclaw.json (versão 2026.2.26)
- **Resolução:** Remover a chave — quiet hours são implementados via SOUL.md
- **Lição:** Sempre verificar release notes antes de adicionar novas chaves ao openclaw.json

### 2026-03-03 — Groq Whisper retornando NOT_FOUND
- **Sintoma:** Transcrição de áudio falha com "NOT_FOUND"
- **Causa provável:** GROQ_API_KEY não chegando ao processo de transcrição, ou Python ausente no container
- **Status:** Pendente verificação — se der 401, chave está errada; se der 404, endpoint mudou

---

## Quando Usar Esta Skill

- Qualquer cron job retornar erro
- `web_fetch` para o SAAS retornar status não-200
- Tool de skill falhar silenciosamente
- Container reiniciar inesperadamente
- Ação automática não produzir efeito esperado

**Invocação:** Quando encontrar erro em tarefa automática, cite mentalmente:
*"Aplicando protocolo de diagnóstico: Fase 1 — qual foi o erro exato?"*

---

## Verificação de Saúde Rápida

Para testar se o SAAS está respondendo:
```
web_fetch(url="${SAAS_URL}/api/openclaw-tools?action=system_status",
          headers={"X-OpenClaw-Key": "${OPENCLAW_TOOLS_API_KEY}"})
```
- Resposta 200 com JSON → SAAS online
- Resposta 401 → API key incorreta
- Timeout ou erro de conexão → SAAS offline
