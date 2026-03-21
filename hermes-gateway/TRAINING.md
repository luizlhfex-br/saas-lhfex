# TRAINING - Hermes LHFEX

## Template SOP para novas skills

Toda skill nova deve declarar:

- Gatilho: quando usar
- Inputs: dados minimos
- Passos: sequencia operacional
- Output: formato esperado
- Validacao: como saber que deu certo
- Erros comuns: o que evitar com base em `LEARNED_RULES.md`

## Estrategia Iceberg

### Carregamento

- Carregar `contexto_completo` uma vez por sessao quando o assunto for LHFEX.
- Para subtarefas, carregar apenas o contexto do dominio necessario.
- Preferir dados resumidos do SaaS a reabrir fontes grandes sem necessidade.

### Limites de qualidade

| Tokens no contexto | Qualidade esperada | Acao |
| --- | --- | --- |
| < 10000 | 100% | ideal |
| 10000-50000 | 95% | aceitavel |
| 50000-100000 | 85% | resumir dados antigos |
| > 100000 | < 70% | compactar ou iniciar nova sessao |

### Pruning

- apos web-search: manter URL, fonte e resumo; descartar HTML bruto
- apos PDF: manter apenas trechos relevantes e conclusoes
- conversas longas: resumir mensagens antigas e manter as ultimas em detalhe
- heartbeat e cron: sobrescrever estado vivo em vez de acumular ruido

### Bloom detection

Se o agente comecar a:

- repetir o mesmo contexto
- misturar assuntos de sessoes diferentes
- responder com detalhe irrelevante
- produzir fatos plausiveis sem evidencia

acao:

1. resumir o contexto atual
2. iniciar sessao limpa se necessario
3. recarregar so o minimo necessario

## Execucao isolada

Skills pesadas devem:

- executar em contexto isolado quando possivel
- retornar so o dado final e a evidencia essencial
- evitar poluir a sessao principal com residuos intermediarios
