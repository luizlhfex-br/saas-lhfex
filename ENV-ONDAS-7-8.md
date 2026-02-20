# Variáveis de Ambiente Necessárias (Ondas 7 & 8)

## 🔐 Segurança & Rate Limiting

### REDIS_URL
**Obrigatório para rate limiting em produção**

```bash
REDIS_URL=redis://localhost:6379
# OU para Redis com senha:
REDIS_URL=redis://:password@localhost:6379
# OU para Redis Cloud/Upstash:
REDIS_URL=rediss://default:password@host:port
```

**Fallback**: Se não configurado, rate limiting será desabilitado (fail-open)

---

## 📊 Monitoramento & Error Tracking

### SENTRY_DSN
**Obrigatório para rastreamento de erros em produção**

```bash
SENTRY_DSN=https://[public-key]@[org-id].ingest.sentry.io/[project-id]
```

**Obtenção**:
1. Crie conta em https://sentry.io (gratuito até 5K eventos/mês)
2. Crie novo projeto "React Router" ou "Remix"
3. Copie o DSN fornecido

**Fallback**: Se não configurado, error tracking será desabilitado

### COMMIT_SHA (opcional)
```bash
COMMIT_SHA=abc123def456
```

Usado para release tracking no Sentry. Coolify já injeta automaticamente.

---

## ✅ Configuração no Coolify

Acesse: `https://app.lhfex.com.br` → Applications → saas-lhfex → Environment Variables

Adicione:
- `REDIS_URL` (Runtime Only)
- `SENTRY_DSN` (Runtime Only)

Depois clique em **Restart** (não precisa rebuild).

---

## 🧪 Teste Local

### Redis
```bash
# Instalar Redis localmente (Windows)
choco install redis

# Ou usar Docker
docker run -d -p 6379:6379 redis:alpine

# Verificar conexão
redis-cli ping
# Resposta esperada: PONG
```

### Sentry
Teste gerando um erro proposital:
```bash
curl -X POST https://app.lhfex.com.br/api/test-error
```

Verifique em: https://sentry.io → Projects → seu-projeto → Issues
