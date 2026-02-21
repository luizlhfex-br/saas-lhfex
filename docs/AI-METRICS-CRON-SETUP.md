# Configuração do Cron Job - AI Metrics Monitoring

Este documento explica como configurar o monitoramento automático de métricas de IA no servidor de produção.

## 📋 O que faz?

O cron job `ai-metrics-cron.mjs` executa a cada 15 minutos e:
- ✅ Monitora saúde dos provedores de IA (Gemini, OpenRouter, DeepSeek)
- ✅ Rastreia taxa de erro, latência e custos
- ✅ Envia alertas via Telegram quando limites são excedidos
- ✅ Detecta falhas consecutivas (5+) automaticamente

## 🔧 Configuração no Coolify

### Opção 1: Via Dashboard Coolify (Recomendado)

1. **Acesse o Coolify Dashboard**
   - Abra seu projeto `saas-lhfex`
   - Vá para a aba **"Scheduled Tasks"** ou **"Cron Jobs"**

2. **Adicione um novo Scheduled Task**
   ```
   Nome: AI Metrics Monitor
   Comando: node scripts/ai-metrics-cron.mjs
   Schedule: */15 * * * *
   ```
   
3. **Salve e ative**

### Opção 2: Configuração Manual via SSH

1. **Conecte ao servidor via SSH**
   ```bash
   ssh seu-usuario@seu-servidor.com
   cd /caminho/para/saas-lhfex
   ```

2. **Teste o script manualmente primeiro**
   ```bash
   node scripts/ai-metrics-cron.mjs
   ```
   
   ✅ Deve exibir:
   ```
   [CRON] AI Metrics Check started at 2026-02-21T...
   [AI_METRICS] Running scheduled metrics check...
   [AI_METRICS] Metrics check completed
   [CRON] AI Metrics Check completed successfully
   ```

3. **Adicione ao crontab**
   ```bash
   crontab -e
   ```
   
   Adicione esta linha:
   ```bash
   */15 * * * * cd /app && node scripts/ai-metrics-cron.mjs >> /var/log/ai-metrics.log 2>&1
   ```

4. **Verifique se foi adicionado**
   ```bash
   crontab -l
   ```

5. **Monitore os logs**
   ```bash
   tail -f /var/log/ai-metrics.log
   ```

## 📊 Schedule Explicado

- `*/15 * * * *` significa:
  - `*/15` = A cada 15 minutos
  - `*` = Toda hora
  - `*` = Todo dia do mês
  - `*` = Todo mês
  - `*` = Todo dia da semana

Você pode ajustar conforme necessário:
- `*/5 * * * *` = A cada 5 minutos (mais frequente)
- `*/30 * * * *` = A cada 30 minutos (menos frequente)
- `0 * * * *` = A cada hora (no minuto 0)

## 🚨 Limites de Alerta

O sistema envia alertas via Telegram quando:

| Métrica | Limite | Severidade |
|---------|--------|------------|
| Taxa de erro | >30% | 🚨 Critical |
| Latência média | >10s | ⚠️ Warning |
| Custo diário | >$5 | ⚠️ Warning |
| Falhas consecutivas | ≥5 | 🚨 Critical |

**Cooldown**: 1 hora entre alertas do mesmo tipo (evita spam)

## 🔍 Verificação Pós-Configuração

1. **Aguarde 15 minutos** após configurar
2. **Verifique os logs**:
   - Coolify Dashboard → Logs
   - Ou via SSH: `tail -f /var/log/ai-metrics.log`
3. **Verifique o banco de dados**:
   ```sql
   SELECT provider, feature, success, latency_ms, created_at 
   FROM ai_usage_logs 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

## 🛠️ Troubleshooting

### Cron job não está executando

**Coolify:**
- Verifique se o container está rodando
- Verifique os logs do container
- Reinicie o serviço se necessário

**Crontab:**
```bash
# Verifique se o cron está rodando
sudo service cron status

# Reinicie o cron
sudo service cron restart

# Verifique logs do sistema
grep CRON /var/log/syslog
```

### Script falha ao executar

```bash
# Teste manualmente com logs detalhados
NODE_ENV=production node scripts/ai-metrics-cron.mjs

# Verifique variáveis de ambiente
env | grep -E "DATABASE_URL|GEMINI_API_KEY|OPENROUTER_API_KEY|TELEGRAM"
```

### Não recebe alertas no Telegram

1. Verifique `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` no `.env`
2. Teste o envio manual:
   ```bash
   curl -X POST "https://api.telegram.org/bot<SEU_TOKEN>/sendMessage" \
     -d "chat_id=<SEU_CHAT_ID>" \
     -d "text=Teste de alerta AI Metrics"
   ```

## 📈 Monitoramento Adicional

Depois que o cron job estiver ativo, você pode acessar as métricas programaticamente:

**Endpoint interno** (se implementar):
```bash
GET /api/ai-metrics?view=dashboard
```

**Consulta direta no banco**:
```sql
-- Taxa de sucesso por provider nas últimas 24h
SELECT 
  provider, 
  feature,
  COUNT(*) as total,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successes,
  ROUND(100.0 * SUM(CASE WHEN success THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate,
  AVG(latency_ms) as avg_latency_ms,
  SUM(cost_estimate::numeric) as total_cost
FROM ai_usage_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY provider, feature
ORDER BY total DESC;
```

## ✅ Próximos Passos

1. ✅ Migration aplicada (coluna `latency_ms` adicionada)
2. ✅ Cron job configurado
3. 🔄 Aguardar 15 minutos e verificar logs
4. 📊 Monitorar alertas no Telegram
5. 🎯 Ajustar limites se necessário em `app/lib/ai-metrics.server.ts`

---

**Nota**: Se não quiser usar o cron job agora, não tem problema! O sistema continua funcionando normalmente. As métricas são coletadas em todas as operações de IA automaticamente. O cron job apenas adiciona verificação proativa e alertas automáticos.
