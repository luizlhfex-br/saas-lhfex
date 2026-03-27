# IDEAS - Backlog Curado
> Ultima atualizacao: 2026-03-17

---

## IA / Hermes Agent

### Embeddings no SaaS e no Hermes Agent
- Objetivo: adicionar busca semantica e RAG interno no SaaS para clientes, processos, promocoes, radios, docs e memoria operacional do Hermes Agent
- Meta pratica: permitir que o sistema recupere contexto util por significado, nao so por palavra exata
- Abordagem recomendada:
  - fase 1 com `gemini-embedding-001` para texto
  - armazenar vetores no PostgreSQL com `pgvector`
  - busca por cosseno
  - fase 2 multimodal com `gemini-embedding-2-preview` so depois da base textual estabilizar

#### Principios do desenho
- Nao usar embeddings para regra fiscal deterministica, aliquota exata, NCM oficial ou calculo tributario fechado
- Usar embeddings para contexto, busca semantica, memoria, agrupamento e apoio ao Hermes Agent
- Manter tudo no Postgres primeiro; nao abrir vetor DB externo sem necessidade real
- Respeitar escopo:
  - negocio com `companyId`
  - vida pessoal com `userId`
  - nunca misturar resultado empresarial com dado pessoal na mesma busca

#### Fontes de dados prioritarias
- Fase 1:
  - CRM: clientes, contatos, observacoes e historico relevante
  - Processos: descricao, observacoes, timeline, embarques e metadados
  - Docs internos: changelog, docs operacionais, memoria e prompts que ajudem o Hermes Agent
- Fase 2:
  - Promocoes, Literario, Insta e Radio Monitor
  - transcricoes, regras, posts e observacoes
  - descricoes blindadas e textos de apoio de comex
- Fase 3:
  - PDFs, imagens, audio e possivel busca cruzada multimodal com `gemini-embedding-2-preview`

#### Plano tecnico por fases

##### Fase 0 - Pre requisitos e decisao de arquitetura
- Validar suporte real a `CREATE EXTENSION vector;` no banco de desenvolvimento e producao
- Fixar modelo e dimensao inicial:
  - modelo: `gemini-embedding-001`
  - dimensao inicial recomendada: `768`
  - motivo: menor custo de armazenamento e boa qualidade para busca; a documentacao do Gemini recomenda `768`, `1536` ou `3072`
- Decidir padrao de normalizacao:
  - para `768` e `1536`, normalizar o vetor antes de salvar
  - usar similaridade por cosseno
- Definir envs futuras:
  - `EMBEDDINGS_PROVIDER=gemini_api`
  - `EMBEDDINGS_MODEL=gemini-embedding-001`
  - `EMBEDDINGS_DIMENSIONS=768`
  - `EMBEDDINGS_ENABLED=false` no inicio

##### Fase 1 - Schema e infraestrutura base
- Criar migration para habilitar `pgvector`
- Criar tabela `embedding_documents`
  - `id`
  - `scope_type` (`business`, `personal`, `system`)
  - `company_id`
  - `user_id`
  - `source_type` (`client`, `contact`, `process`, `promotion`, `doc`, etc.)
  - `source_id`
  - `title`
  - `body_hash`
  - `language`
  - `embedding_model`
  - `embedding_dimensions`
  - `last_embedded_at`
  - `is_active`
  - `metadata jsonb`
- Criar tabela `embedding_chunks`
  - `id`
  - `document_id`
  - `company_id`
  - `user_id`
  - `chunk_index`
  - `chunk_text`
  - `chunk_hash`
  - `token_count`
  - `embedding vector(768)`
  - `normalized boolean`
  - `metadata jsonb`
  - `created_at`
  - `updated_at`
- Criar tabela `embedding_jobs`
  - `id`
  - `scope_type`
  - `company_id`
  - `user_id`
  - `source_type`
  - `source_id`
  - `status` (`pending`, `running`, `done`, `failed`, `skipped`)
  - `attempts`
  - `error_message`
  - `started_at`
  - `finished_at`
- Criar indices:
  - btree em `company_id`, `user_id`, `source_type`, `source_id`
  - HNSW em `embedding vector_cosine_ops`
  - avaliar IVFFlat so se HNSW ficar pesado no host atual

##### Fase 2 - Servico de embedding e chunking
- Criar helper dedicado, por exemplo `app/lib/embeddings.server.ts`
- Responsabilidades:
  - normalizar texto
  - remover boilerplate inutil
  - quebrar em chunks
  - gerar hash
  - evitar re-embed de conteudo sem mudanca
  - chamar Gemini Embeddings
  - normalizar vetor quando necessario
  - salvar vetores e metadados
- Estrategia de chunking inicial:
  - chunks de 500 a 700 tokens
  - overlap de 60 a 90 tokens
  - incluir titulo/contexto do registro no topo do chunk quando fizer sentido
- Tipos de tarefa do embedding:
  - documentos indexados: `RETRIEVAL_DOCUMENT`
  - busca do usuario/agente: `RETRIEVAL_QUERY`
  - similaridade pura e clustering: deixar para depois

##### Fase 3 - Pipeline de indexacao
- Backfill inicial por script/command:
  - `npm run embeddings:backfill:crm`
  - `npm run embeddings:backfill:processes`
  - `npm run embeddings:backfill:docs`
- Reindex incremental:
  - ao criar/editar cliente
  - ao criar/editar processo
  - ao adicionar observacao relevante
  - ao importar ou extrair texto de documento
- Regras de eficiencia:
  - nunca reprocessar se `body_hash` nao mudou
  - agrupar jobs pequenos em batch quando possivel
  - processar backfill pesado fora do horario critico

##### Fase 4 - Busca semantica no backend
- Criar servico `semanticSearch`
- Entrada minima:
  - `query`
  - `scopeType`
  - `companyId` ou `userId`
  - `sourceTypes`
  - `topK`
  - filtros opcionais por data/status
- Fluxo:
  - gerar embedding da query com `RETRIEVAL_QUERY`
  - buscar top K por cosseno
  - aplicar filtros de autorizacao antes de devolver
  - devolver score, origem, trecho e metadados
- Etapa seguinte:
  - busca hibrida = vetor + palavra-chave/tsvector
  - re-ranking leve com LLM so se o recall estiver ruim

##### Fase 5 - Integracao com OpenClaw
- Nova tool de contexto semantico no SaaS
  - exemplo: `buscar_contexto_semantico`
- Usos iniciais:
  - recuperar historico de cliente por significado
  - encontrar processos parecidos
  - puxar regras e notas de promocoes antigas
  - montar briefing para agentes sem depender de prompt gigante
- Guardrails:
  - limitar numero de chunks por resposta
  - citar fonte do trecho (`source_type`, `source_id`, titulo)
  - nao misturar escopos
  - registrar uso no log de AI/agent runs

##### Fase 6 - UI e observabilidade
- Criar tela administrativa de embeddings
- Mostrar:
  - total de documentos indexados
  - total de chunks
  - ultimos jobs
  - falhas de indexacao
  - modelo, dimensao e tamanho estimado
  - top fontes indexadas
- Criar busca interna semantica no SaaS para teste operacional
- Exibir quando o resultado veio de busca semantica e de qual fonte

##### Fase 7 - Multimodal
- So iniciar depois da fase textual estar confiavel
- Alvo:
  - PDFs de regulamento
  - imagens relevantes
  - audio curto
  - documentos de ate seis paginas quando fizer sentido
- Modelo alvo: `gemini-embedding-2-preview`
- Uso principal:
  - promocoes e sorteios
  - anexos do Radio Monitor
  - documentos operacionais curtos

#### Regras de seguranca e escopo
- Nunca indexar `.env`, secrets, tokens, chaves ou payloads sensiveis
- Nunca indexar tudo sem filtro; indexar so campos com valor para busca
- Para negocio, toda consulta deve exigir `companyId`
- Para vida pessoal, toda consulta deve exigir `userId`
- Registrar origem do texto embedado para permitir auditoria e exclusao
- Se o registro for apagado, o documento/chunk correspondente deve ser desativado ou removido

#### Custos e performance
- Comecar com `768` dimensoes para reduzir armazenamento e CPU
- Medir:
  - tempo medio de embed
  - custo por 1.000 chunks
  - crescimento da base
  - latencia da busca
- So subir para `1536` se o recall real estiver insuficiente
- So considerar `3072` se houver ganho claro em casos de comex e memoria complexa

#### Riscos conhecidos
- `pgvector` pode nao estar habilitado no Postgres atual
- backfill grande pode competir com carga normal do SaaS
- chunks ruins geram busca ruim; a qualidade do chunking importa mais do que "ligar embeddings"
- embeddings nao substituem filtros deterministas nem regras fiscais

#### Entregas sugeridas por sprint
- Sprint 1:
  - pgvector
  - schema base
  - helper de embeddings
  - indexacao de CRM e docs internos
- Sprint 2:
  - indexacao de processos
  - semantic search interna
  - painel administrativo
- Sprint 3:
  - tool do OpenClaw
  - RAG operacional para clientes e processos
  - logs e metricas
- Sprint 4:
  - promocoes, insta, radio monitor
  - multimodal seletivo

#### Criterios de pronto
- Backfill inicial concluido sem quebrar producao
- Busca semantica encontra cliente/processo correto em casos reais
- OpenClaw passa a usar contexto recuperado antes de responder operacoes complexas
- Painel mostra cobertura, falhas e volume indexado
- O sistema continua respeitando `companyId` e `userId` em todo o fluxo

### Google Workspace como extensao operacional do OpenClaw
- Objetivo: permitir que o OpenClaw use Gmail, Calendar, Drive, Docs e Sheets como extensoes operacionais, com acesso controlado e auditavel
- Referencia principal: [Google Workspace CLI Assistant](https://mcpmarket.com/tools/skills/google-workspace-cli-assistant)
- Direcao tecnica:
  - autenticar com o metodo suportado pelo Google Workspace CLI/SDK, sem expor senha em chat
  - mapear acoes permitidas por dominio: leitura, criacao assistida, atualizacao e anexos
  - separar o que o OpenClaw pode fazer sozinho do que exige confirmacao do Luiz
  - registrar log de cada operacao com origem, usuario, item afetado e resultado
- Casos de uso de alto valor:
  - criar eventos e lembretes no Calendar
  - localizar arquivos e contratos no Drive
  - resumir threads de Gmail
  - transformar atas e documentos em tarefas operacionais
  - alimentar briefings diários do OpenClaw com contexto do Workspace

### Arquitetura alvo do OpenClaw
- Plano mestre salvo em `docs/OPENCLAW-ARCHITECTURE-PLAN.md`
- Catalogo versionado dos agentes salvo em `openclaw-gateway/agents.catalog.json`
- Baseada em absorver a arquitetura do `awesome-openclaw-agents` de forma adaptada ao contexto real da LHFEX

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

### Skills candidatas para o OpenClaw lider
- [React Code Fix & Linter](https://mcpmarket.com/tools/skills/react-code-fix-linter)
  - util para revisar e corrigir codigo com foco em qualidade e CI
- [GitHub Integration](https://mcpmarket.com/tools/skills/github-integration)
  - bom para PRs, issues, checks e rotina de engenharia
- [Coding Agent Orchestrator](https://mcpmarket.com/tools/skills/coding-agent-orchestrator)
  - forte candidato para o lider coordenar agentes e delegar tarefas complexas
- [Multi-Reviewer Patterns](https://mcpmarket.com/tools/skills/multi-reviewer-patterns)
  - bom para revisao multiangulo antes de fechar entregas sensiveis
- [Parallel Debugging](https://mcpmarket.com/tools/skills/parallel-debugging)
  - util quando o problema precisa de investigacao paralela e rapida
- [Team Communication Protocols](https://mcpmarket.com/tools/skills/team-communication-protocols)
  - interessante para padronizar handoff e delegacao entre agentes
- [Agent Team Task Coordination](https://mcpmarket.com/tools/skills/agent-team-task-coordination)
  - bom para dividir trabalho em partes paralelizaveis com menor conflito
- [Prompt Finder & Enhancer](https://mcpmarket.com/tools/skills/prompt-finder-enhancer)
  - util para melhorar prompts e padroes de instrucao do proprio OpenClaw
- [Skill Writer](https://mcpmarket.com/tools/skills/skill-writer)
  - candidato direto para criar e manter skills internas do projeto
- [Web Automation & Browser Control](https://mcpmarket.com/tools/skills/web-automation-browser-control)
  - bom para smoke, automacao de portais e coleta de dados em navegacao real
- [Remote Browser Automation](https://mcpmarket.com/tools/skills/remote-browser-automation)
  - alternativa forte para fluxos que precisam de browser acessivel ao agente
- [Resource Curator](https://mcpmarket.com/tools/skills/resource-curator)
  - interessante para manter listas, referencias e links do ecossistema organizados

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

### Financeiro PJ - camadas ERP futuras
- Direcao atual aprovada:
  - manter o modulo principal da LHFEX com cara de fluxo de caixa forte, simples e operacional
- Expansoes futuras quando o volume crescer:
  - centros de custo por area ou projeto
  - contas a pagar e a receber com aprovacao por etapa
  - plano de contas mais rigido
  - conciliacao bancaria mais profunda
  - competencia x caixa
  - DRE gerencial
  - fluxo por unidade de negocio
  - regras de permissao por perfil
- Gatilhos para considerar essa evolucao:
  - mais pessoas usando o financeiro
  - aumento relevante de lancamentos mensais
  - necessidade de relatarios gerenciais mais formais
  - fechamento mensal mais demorado ou manual demais

### Promocoes Instagram - participacao assistida com amigos
- Ideia para amadurecer depois:
  - manter uma lista autorizada de amigos que aceitam ser marcados em sorteios
  - permitir que a IA encontre oportunidades e participe marcando esses amigos de forma controlada
- Desenho futuro:
  - cadastro de amigos com @, nome, limite de uso e observacoes
  - lista de hashtags, contas e palavras-chave monitoradas
  - ranking de oportunidades por prazo, premio, confiabilidade e esforco
  - fila de participacao sugerida antes da execucao
  - historico de quem foi marcado e em qual campanha
- Guardrails importantes:
  - nunca marcar sem lista explicitamente autorizada
  - respeitar rodizio para nao usar sempre as mesmas pessoas
  - limitar volume por dia e por perfil
  - evitar comentarios repetitivos ou com cara de spam
  - registrar evidencia da participacao e do comentario publicado
- Caminho tecnico futuro:
  - browser logado
  - leitura da pagina do post
  - extracao das regras
  - composicao do comentario
  - aprovacao ou automacao parcial conforme confianca do fluxo

### Mobile
- App leve para consulta e alerta

### Monetizacao / App de concursos
- Criar um app gamificado de questoes de concursos no estilo "Show do Milhao", com trilhas por edital ativo ou previsto
- Usar questoes do edital anterior e questoes de treino para deixar o estudo mais interativo e divertido
- Modelo gratuito com anuncios e uma versao paga barata, por exemplo US$ 1 por 3 meses, para remover ads e liberar recursos extras
- Para cada concurso:
  - abrir uma campanha propria
  - puxar questoes relacionadas ao edital
  - apresentar alternativas no formato de jogo
  - acompanhar desempenho e progresso do usuario
- Essa ideia pode virar um produto lateral com potencial de receita recorrente e baixo custo de entrada

### Referencias externas
- Ver [REFERENCIAS-EXTERNAS.md](./REFERENCIAS-EXTERNAS.md) para os links vivos de skills, OpenClaw e GCP.

### Curadoria externa - Hostinger
- Guardar como referência de produto, sem aplicar agora.
- Control Tower LHFEX:
  - visão executiva de CRM, processos, financeiro, câmbio, alertas e saúde operacional em uma camada mais gerencial
- Gestão de fornecedores, assinaturas e renovações:
  - transformar o módulo atual em controle mais forte de custo recorrente, risco e renovação
- Programa de indicações B2B:
  - parcerias entre clientes, despachantes, agentes e contatos de comércio exterior
- MicroSaaS paralelo de concursos:
  - manter como produto separado do SaaS principal, validando primeiro por landing page e teste de interesse
- Repositórios para consulta futura:
  - Awesome, Public APIs, System Design Primer, Developer Roadmap e React oficial

---

## Removido do backlog ativo

- ideias ja implementadas
- chain antiga com `openrouter_paid`
- migracao apressada para bot unico
- itens sem dono tecnico claro
