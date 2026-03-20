/**
 * Application Version Configuration
 * Update this file whenever releasing a new version
 */

export const APP_VERSION = "2.9.38";
export const APP_RELEASE_DATE = "2026-03-20";
export const APP_NAME = "LHFEX SaaS";

export type ChangelogItemType = "feature" | "improvement" | "fix" | "infra";

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  items: {
    type: ChangelogItemType;
    text: string;
  }[];
}

export const VERSION_HISTORY: ChangelogEntry[] = [
  {
    version: "2.9.38",
    date: "2026-03-20",
    title: "Hermes em producao com diagnostico operacional confiavel",
    items: [
      { type: "feature", text: "Hermes: nova skill lhfex-runtime para diagnosticar provider, modelo, acesso ao SaaS, Google, Telegram e host com evidencia real" },
      { type: "improvement", text: "SOUL e skill SAAS do Hermes agora validam catalogo_acoes e hermes status antes de responder sobre acesso ou LLM em uso" },
      { type: "improvement", text: "Bootstrap, runbook e checklist do Hermes foram alinhados ao runtime estavel com DeepSeek primario e MiniMax free como fallback" },
      { type: "infra", text: "Gateway Hermes permaneceu ativo no VPS apos sincronizacao do contexto, mantendo o OpenClaw antigo preservado para rollback" },
    ],
  },
  {
    version: "2.9.37",
    date: "2026-03-20",
    title: "Hermes Agent preparado no VPS com bridge SaaS e Google",
    items: [
      { type: "feature", text: "Hermes: novo pacote versionado hermes-gateway com SOUL, runbook, checklist de cutover, bootstrap idempotente e skills LHFEX no formato oficial SKILL.md" },
      { type: "feature", text: "OpenClaw Tools: novas actions google_status, google_buscar_drive, google_criar_evento_calendario e google_criar_planilha para operar Google Workspace via SaaS" },
      { type: "improvement", text: "Hermes no VPS: release v2026.3.17 instalada, Telegram configurado, fallback DeepSeek validado e cron jobs preparados sem derrubar o OpenClaw atual" },
      { type: "improvement", text: "Skill SAAS do gateway foi ampliada para documentar o bridge Google e o contrato operacional usado por OpenClaw e Hermes" },
    ],
  },
  {
    version: "2.9.36",
    date: "2026-03-19",
    title: "OpenClaw com acesso SaaS mais confiavel no Telegram",
    items: [
      { type: "fix", text: "AIrton: SOUL e AGENTS reforcados para usar /api/openclaw-tools em consultas de negocio, evitando confusao com processos internos do runtime" },
      { type: "improvement", text: "OpenClaw Gateway: fallback free principal passou para openrouter/minimax/minimax-m2.5:free, mantendo openrouter/free como fallback adicional" },
      { type: "improvement", text: "AIrton: regra operacional para nao pedir URL/token ao Luiz quando a consulta for do SaaS LHFEX" },
      { type: "improvement", text: "AIrton: transparencia de provider/model reforcada para responder qual LLM esta em uso quando solicitado" },
    ],
  },
  {
    version: "2.9.35",
    date: "2026-03-19",
    title: "OpenClaw estabilizado no SaaS com catalogo de tools expandido",
    items: [
      { type: "fix", text: "OpenClaw Gateway: provider principal corrigido para google-vertex/gemini-2.0-flash, removendo erro de modelo desconhecido no runtime" },
      { type: "fix", text: "OpenClaw Gateway: heartbeat interno foi desligado no openclaw.json para parar tentativas de envio para @heartbeat" },
      { type: "feature", text: "OpenClaw Tools: novo action catalogo_acoes com mapa completo de GET/POST e exemplos prontos para uso" },
      { type: "feature", text: "OpenClaw Tools: novos actions resumo_modulos_saas, listar_faturas e listar_radios para ampliar consulta operacional via Telegram" },
      { type: "improvement", text: "JULia: skill musa-literaria registrada como exclusiva do modulo Literario e integrada ao fluxo de promocoes" },
    ],
  },
  {
    version: "2.9.34",
    date: "2026-03-19",
    title: "Calculadora COMEX com conversao de invoice e taxa Siscomex por adicao",
    items: [
      { type: "feature", text: "Calculadora: nova conversao de invoice por moeda para USD via endpoint proprio, com taxa e fonte exibidas na tela" },
      { type: "feature", text: "Siscomex: taxa passou a ser calculada por quantidade de adicoes de NCM, carregando tabela versionada em data/siscomex" },
      { type: "improvement", text: "NCM por distribuicao: linhas agora incluem ICMS por item, ampliacao visual do bloco e resumo FOB por somatorio real das adicoes" },
      { type: "improvement", text: "COMEX: labels operacionais foram padronizadas para Honorario Despachante, Taxa Siscomex e Dias de Free Time" },
    ],
  },
  {
    version: "2.9.33",
    date: "2026-03-18",
    title: "Settings com cadastro enriquecido da empresa e contas extras",
    items: [
      { type: "feature", text: "Settings: o bloco da empresa passou a editar contato principal, cargo, registro profissional e titular da conta principal" },
      { type: "feature", text: "Settings: contas bancarias adicionais agora podem ser criadas, editadas e excluidas na propria tela" },
      { type: "fix", text: "API e schema do company profile foram alinhados para persistir contato enriquecido e titular bancario sem atualizar tudo de forma cega" },
      { type: "improvement", text: "Cadastro interno da LHFEX foi preenchido com CNPJ, endereco, contato e conta Inter para a tela nao abrir mais como CNPJ nao configurado" },
    ],
  },
  {
    version: "2.9.32",
    date: "2026-03-17",
    title: "Embeddings corrigidos para runtime de producao",
    items: [
      { type: "fix", text: "@google/genai foi movido para dependencies para nao ser removido no prune do Docker e no runtime do Coolify" },
      { type: "fix", text: "OpenClaw: a base de memoria semantica volta a subir no container de producao sem erro de pacote ausente" },
      { type: "improvement", text: "Deploy: a pipeline passa a publicar a imagem com a dependencia de embeddings disponivel no build final" },
    ],
  },
  {
    version: "2.9.31",
    date: "2026-03-17",
    title: "OpenClaw com memoria semantica e briefing operacional",
    items: [
      { type: "feature", text: "Embeddings: o SaaS ganhou a fundacao vetorial com pgvector, jobs de indexacao e busca semantica por cliente, processo e documento" },
      { type: "feature", text: "Memoria: a nova tela de conhecimento semantico permite consultar contexto recuperado e acionar backfill inicial do CRM e dos processos" },
      { type: "feature", text: "OpenClaw: o cron operacional passou a gerar briefing diario com alertas, work items e resumo de saude do squad" },
      { type: "improvement", text: "Observabilidade: o painel de agentes passou a exibir alertas recentes e informacoes mais ricas sobre o estado do squad" },
    ],
  },
  {
    version: "2.9.30",
    date: "2026-03-17",
    title: "Processos abrem com Todos os status por padrao",
    items: [
      { type: "improvement", text: "Processos: a tela inicial agora abre em Todos os status para dar visao geral do fluxo sem filtro aplicado" },
      { type: "improvement", text: "Processos: o filtro continua funcionando normalmente para refinar a lista depois da visao geral inicial" },
      { type: "improvement", text: "Processos: o estado padrao do select foi alinhado com a expectativa operacional de ver tudo primeiro" },
    ],
  },
  {
    version: "2.9.29",
    date: "2026-03-17",
    title: "OpenClaw com resposta de acesso mais segura e objetiva",
    items: [
      { type: "improvement", text: "OpenClaw: a resposta sobre acesso ao SaaS agora pede o minimo necessario e nao sugere senha em chat" },
      { type: "improvement", text: "SOUL.md, AGENTS.md e a skill SAAS foram ajustados para priorizar API/tools e nao assumir browser/sessao sem validacao real" },
      { type: "improvement", text: "IDENTITY.md foi refinado para remover a promessa de acesso total e deixar claro o contrato operacional real" },
    ],
  },
  {
    version: "2.9.28",
    date: "2026-03-17",
    title: "Briefing operacional diário do OpenClaw",
    items: [
      { type: "feature", text: "OpenClaw: o cron diario passou a enviar um briefing operacional com saude dos agentes, work items, handoffs e falhas recentes" },
      { type: "improvement", text: "/automations/overview agora exibe o Briefing Operacional OpenClaw na secao de cron jobs em producao" },
      { type: "improvement", text: "OpenClaw: o briefing registra run e heartbeat na fundacao de observabilidade para manter a trilha auditavel" },
    ],
  },
  {
    version: "2.9.27",
    date: "2026-03-17",
    title: "OpenClaw com matriz de permissões e playbooks por agente",
    items: [
      { type: "feature", text: "OpenClaw: agents.catalog.json ganhou playbooks por agente, deixando claro como cada especialista deve agir em cenarios recorrentes" },
      { type: "improvement", text: "/agents: a tela passou a exibir matriz de permissao, gatilhos, KPIs e playbooks principais de cada agente do squad" },
      { type: "improvement", text: "SOUL.md e AGENTS.md agora tratam playbooks e matriz de permissao como parte do contrato operacional antes de delegar" },
    ],
  },
  {
    version: "2.9.26",
    date: "2026-03-17",
    title: "CSRF dos processos ajustado para proxy reverso",
    items: [
      { type: "fix", text: "CSRF: a validacao same-origin passou a considerar X-Forwarded-Host e X-Forwarded-Proto, evitando falso expirado ao criar processo atras do Coolify" },
      { type: "improvement", text: "Processos: o formulario de novo processo voltou a aceitar o POST normalmente em producao sem perder a protecao contra origem cruzada" },
    ],
  },
  {
    version: "2.9.25",
    date: "2026-03-17",
    title: "OpenClaw com observabilidade operacional por agente",
    items: [
      { type: "feature", text: "OpenClaw: o SaaS ganhou tabelas para agent_runs, agent_heartbeats, agent_handoffs e agent_work_items com companyId e indexes proprios" },
      { type: "feature", text: "OpenClaw: /api/openclaw-tools passou a registrar heartbeat, run, handoff e work item do squad via actions dedicadas" },
      { type: "improvement", text: "/agents: a tela virou painel operacional com resumo de heartbeats, runs, handoffs e work items recentes do OpenClaw" },
      { type: "improvement", text: "OpenClaw: SOUL.md e AGENTS.md agora declaram as actions de observabilidade como parte oficial do fluxo do squad" },
      { type: "improvement", text: "Schema: a fundacao foi registrada em drizzle/migrations/0011_openclaw_observability.sql para manter a base versionada" },
    ],
  },
  {
    version: "2.9.24",
    date: "2026-03-17",
    title: "Calculadora integrada ao detalhe do processo",
    items: [
      { type: "feature", text: "Processos: a tela de detalhe ganhou atalhos diretos para abrir a calculadora ja com o contexto do embarque carregado" },
      { type: "feature", text: "Calculadora: agora aceita processId e modal na URL para pre-preencher FOB, NCM/HS, moeda e referencia do processo" },
      { type: "improvement", text: "Calculadora: o card de contexto mostra referencia, cliente, tipo, incoterm, valor e um atalho para voltar ao processo original" },
      { type: "improvement", text: "Calculadora: o reset voltou a respeitar os valores pre-carregados do processo, evitando perder o contexto operacional" },
    ],
  },
  {
    version: "2.9.23",
    date: "2026-03-17",
    title: "Arquitetura operacional do OpenClaw estruturada por agente",
    items: [
      { type: "feature", text: "OpenClaw: novo agents.catalog.json versiona dominio, responsabilidades, tools, permissoes, gatilhos e KPIs dos 8 agentes do squad" },
      { type: "feature", text: "OpenClaw: cada agente passou a ter README, SOUL, AGENTS, HEARTBEAT e WORKING proprios, deixando de depender apenas de IDENTITY.md" },
      { type: "improvement", text: "Runtime: o entrypoint do gateway agora preserva WORKING.md entre restarts e copia o catalogo para os workspaces em execucao" },
      { type: "improvement", text: "SaaS: a tela /agents passou a ler o catalogo estruturado e a exibir melhor o pacote operacional e os arquivos carregados do squad" },
      { type: "improvement", text: "Planejamento: docs/OPENCLAW-ARCHITECTURE-PLAN.md consolidou o roadmap de absorcao do awesome-openclaw-agents e docs/IDEAS.md guardou as referencias externas e o backlog de embeddings" },
    ],
  },
  {
    version: "2.9.22",
    date: "2026-03-17",
    title: "Google OAuth alinhado ao client JSON e callback protegido",
    items: [
      { type: "fix", text: "Google OAuth: o fluxo passou a usar state em cookie httpOnly e validacao no callback, bloqueando retornos sem correlacao valida" },
      { type: "fix", text: "Google OAuth: a leitura do token salvo deixou de ignorar userId e voltou a buscar apenas o token ativo do usuario autenticado" },
      { type: "improvement", text: "Google OAuth: o backend agora aceita GOOGLE_OAUTH_CLIENT_JSON_PATH como fonte local do client web, com fallback para GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET" },
      { type: "improvement", text: "Google OAuth: o redirect URI passou a ser resolvido pela origem da requisicao ou APP_URL quando GOOGLE_REDIRECT_URI estiver vazio" },
      { type: "improvement", text: "Docs de ambiente: .env.example passou a documentar as variaveis de OAuth do Google, incluindo o uso opcional do JSON baixado do Google Cloud" },
    ],
  },
  {
    version: "2.9.21",
    date: "2026-03-17",
    title: "Calculadora com resumo FOB por NCM e lookup visual melhorado",
    items: [
      { type: "feature", text: "Calculadora: a distribuicao por NCM agora mostra o total FOB somado das linhas e a diferenca contra o FOB principal informado" },
      { type: "improvement", text: "Calculadora: cada linha multi-NCM passou a exibir codigo casado, tipo de match e vigencia da base quando o catalogo local encontra a NCM" },
      { type: "improvement", text: "Calculadora: o bloco principal de lookup de NCM agora mostra codigo casado, match exato ou por prefixo, base vigente e ato normativo da tabela" },
      { type: "improvement", text: "Calculadora: o resumo do lookup principal ficou mais legivel para uso operacional rapido sem abrir outra tela" },
    ],
  },
  {
    version: "2.9.20",
    date: "2026-03-17",
    title: "Catalogo NCM local integrado ao lookup da calculadora",
    items: [
      { type: "feature", text: "Calculadora: o endpoint de NCM passou a consultar primeiro o catalogo local oficial em data/ncm, em vez de depender so de descricao externa" },
      { type: "feature", text: "Backend: novo helper app/lib/ncm-catalog.server.ts carrega automaticamente o arquivo JSON mais recente da tabela vigente e monta indice em memoria por codigo" },
      { type: "improvement", text: "Calculadora: a origem da sugestao agora informa quando a descricao veio do catalogo NCM local combinada com a tabela estimada de aliquotas" },
      { type: "improvement", text: "Operacao: o catalogo local continua substituivel por arquivo mais novo, sem precisar alterar codigo para renovar a base de NCM" },
    ],
  },
  {
    version: "2.9.19",
    date: "2026-03-17",
    title: "Calculadora com NCM automatico e distribuicao saneada",
    items: [
      { type: "fix", text: "Calculadora: o bloco de distribuicao por NCM teve o texto saneado e o duplicado morto foi removido da pagina" },
      { type: "feature", text: "Calculadora: o campo principal de NCM passou a buscar automaticamente as aliquotas estimadas de II, IPI, PIS e COFINS enquanto o codigo e digitado" },
      { type: "feature", text: "Calculadora: cada linha da distribuicao por NCM agora consulta automaticamente as aliquotas estimadas e exibe descricao e fonte da previsao" },
      { type: "improvement", text: "Calculadora: as aliquotas preenchidas continuam editaveis, mantendo o uso como simulacao rapida e nao como enquadramento fiscal definitivo" },
    ],
  },
  {
    version: "2.9.18",
    date: "2026-03-17",
    title: "Vertex alinhado para ADC e teste separado de Express Mode",
    items: [
      { type: "fix", text: "IA: o provider vertex_gemini deixou de depender de GEMINI_VERTEX_API_KEY e agora usa autenticacao Google de servidor via ADC ou arquivo de service account" },
      { type: "improvement", text: "IA: a estrategia de providers e os endpoints de diagnostico passaram a diferenciar project configurado de credencial realmente presente, evitando anunciar Vertex como pronto quando o ADC estiver ausente" },
      { type: "feature", text: "Operacao: novo helper vertex-auth.server centraliza projectId, arquivo GOOGLE_APPLICATION_CREDENTIALS e presenca do ADC local padrao" },
      { type: "feature", text: "Operacao: npm run ops:test-vertex-express foi criado com o SDK oficial @google/genai para validar Express Mode em separado sem contaminar o fluxo principal do SaaS" },
      { type: "improvement", text: "Docs de ambiente: .env.example passou a documentar GOOGLE_PROJECT_ID, GOOGLE_APPLICATION_CREDENTIALS e as envs dedicadas do teste de Express Mode" },
    ],
  },
  {
    version: "2.9.17",
    date: "2026-03-16",
    title: "Edicao completa em promocoes e prioridade para distribuicao por NCM",
    items: [
      { type: "improvement", text: "Calculadora: o bloco de distribuicao por NCM passou a abrir a coluna de entrada, ficando como primeiro item do preenchimento em /calculator" },
      { type: "feature", text: "Promocoes e Insta: os registros ganharam modo de edicao reaproveitando o formulario principal, com ajuste de nome, empresa, datas, premio, link, status, comprovante e observacoes" },
      { type: "feature", text: "Loterias: o formulario passou a servir para criar e editar aposta, incluindo tipo de jogo, data, numeros, status, resultado, valor ganho e notas" },
      { type: "improvement", text: "Promocoes: os cards passaram a expor acao direta de editar sem depender apenas da troca rapida de status" },
    ],
  },
  {
    version: "2.9.16",
    date: "2026-03-16",
    title: "Insta separado nas promocoes e teste real do Vertex",
    items: [
      { type: "fix", text: "Promocoes: a aba Insta passou a ficar no fim da navegacao, com KPI separado da aba principal e preservacao de tab ao trocar o filtro de status" },
      { type: "fix", text: "Promocoes/Insta: o formulario deixou de exibir PDF, tipo, data inicial e numeros da sorte; agora o fluxo usa link do post e prazo final como base" },
      { type: "improvement", text: "Promocoes/Insta: cards do Instagram deixaram de mostrar tipo e data inicial, reduzindo ruido no acompanhamento dos posts cadastrados" },
      { type: "improvement", text: "Infra/IA: novo script ops:test-vertex testa o provider Vertex forzado e a chain real com o .env.codex local, registrando claramente quando cai para OpenRouter Free" },
      { type: "improvement", text: "Planejamento: endurecimento de repo/segredos foi movido para docs/IDEAS.md como backlog futuro, para revisao manual posterior" },
    ],
  },
  {
    version: "2.9.15",
    date: "2026-03-16",
    title: "Fallback livre do OpenClaw alinhado com a OpenRouter atual",
    items: [
      { type: "fix", text: "OpenClaw: openclaw.json deixou de apontar para o slug invalido do Qwen Free e passou a usar openrouter/free como fallback gratuito" },
      { type: "fix", text: "Telegram: badges e mensagens dos bots foram alinhados com o provider real, evitando respostas marcadas como Vertex quando a tentativa free falhou" },
      { type: "improvement", text: "IA: o primeiro fallback livre do SaaS agora usa o roteador openrouter/free, que esta respondendo no ambiente atual com selecao automatica do modelo gratuito" },
      { type: "improvement", text: "UI: painel de agentes e dashboard de uso passaram a exibir OpenRouter Free em vez do rotulo antigo de Qwen Free" },
    ],
  },
  {
    version: "2.9.14",
    date: "2026-03-15",
    title: "Hardening de webhooks, diagnostico e escopo por empresa",
    items: [
      { type: "fix", text: "Telegram: os webhooks do SaaS e do OpenClaw agora exigem o header secreto do Telegram e o setup do webhook passou a aceitar apenas requisicoes com chave administrativa" },
      { type: "fix", text: "Autorizacao: detalhes e edicoes de CRM, contatos, processos e download de documentos passaram a validar companyId antes de ler ou alterar dados" },
      { type: "fix", text: "Diagnostico: /api/ai-diagnostics e /api/chat-health agora exigem sessao do Luiz, enquanto /api/health e /api/monitor-openclaw deixaram de expor metadados internos" },
      { type: "improvement", text: "Seguranca operacional: foi adicionado um helper central para derivar e validar secrets de webhook sem depender de segredos expostos no repositorio" },
    ],
  },
  {
    version: "2.9.13",
    date: "2026-03-15",
    title: "Instagram nas promocoes, radio monitor ampliado e chat estabilizado",
    items: [
      { type: "feature", text: "Promocoes: nova aba Insta registra posts oficiais do Instagram, separa os cards por origem e deixa a IA preencher datas, regras e observacoes a partir do link" },
      { type: "improvement", text: "Radio Monitor: radios agora podem guardar tambem o link do Instagram, com edicao e atalhos diretos na listagem" },
      { type: "fix", text: "Chat interno: OpenClaw passou a ser aceito no schema do /api/chat e ganhou cobertura E2E para evitar regressao no seletor de agente" },
      { type: "fix", text: "CSRF local: o cookie saiu do prefixo __Host- em ambiente HTTP de desenvolvimento, restaurando login e suites E2E sem afetar producao" },
    ],
  },
  {
    version: "2.9.12",
    date: "2026-03-15",
    title: "Vida Pessoal abre com Promocoes e Sorteios",
    items: [
      { type: "improvement", text: "Vida Pessoal: a secao Promocoes e Sorteios passou a ser a primeira exibida na landing do modulo" },
      { type: "improvement", text: "UI: a rota principal /personal-life foi regravada com textos saneados e mesma navegacao dos modulos existentes" },
    ],
  },
  {
    version: "2.9.11",
    date: "2026-03-15",
    title: "Skills visuais, assinaturas no financeiro e literario com IA",
    items: [
      { type: "feature", text: "Agentes: a aba Conhecimento IA agora le o openclaw.json e os prompts reais para exibir skills ativas, cadeia de modelos e matriz de alinhamento por agente" },
      { type: "improvement", text: "Financeiro: Assinaturas saiu do menu principal e passou a viver como aba interna do modulo financeiro, mantendo o mesmo CRUD operacional" },
      { type: "feature", text: "Promocoes/Literario: concursos cadastrados agora podem ser editados diretamente na lista" },
      { type: "feature", text: "Promocoes/Literario: novo botao Ler link com IA busca o regulamento, extrai campos principais e preenche o formulario automaticamente" },
    ],
  },
  {
    version: "2.9.10",
    date: "2026-03-15",
    title: "OpenClaw atualizado para 2026.3.13",
    items: [
      { type: "infra", text: "OpenClaw Gateway: Dockerfile agora instala openclaw@2026.3.13, substituindo a versao 2026.3.2" },
      { type: "improvement", text: "OpenClaw: mensagem de deploy do Telegram e o system_status exposto pelo SaaS passaram a refletir a versao 2026.3.13" },
      { type: "infra", text: "Validacao previa confirmou que openclaw@2026.3.13 instala corretamente no mesmo stack base node:22-slim usado em producao" },
    ],
  },
  {
    version: "2.9.9",
    date: "2026-03-14",
    title: "Smoke de producao resiliente ao aquecimento do OpenClaw",
    items: [
      { type: "fix", text: "CI: scripts/smoke-production.mjs agora faz retry controlado no monitor do OpenClaw para absorver o tempo real de boot do gateway apos o deploy" },
      { type: "improvement", text: "Smoke: logs de tentativa passaram a indicar aquecimento do endpoint sem mascarar falhas definitivas" },
    ],
  },
  {
    version: "2.9.8",
    date: "2026-03-14",
    title: "CSRF reforcado, planejamento saneado e smoke pos-deploy fechado",
    items: [
      { type: "fix", text: "Seguranca: login, logout, settings, CRM, processos e subscriptions agora validam CSRF e origem same-origin antes de aceitar POST" },
      { type: "fix", text: "Sessao: cookie de autenticacao migrou para __Host-session em producao, com leitura legada mantida para nao derrubar sessoes existentes no rollout" },
      { type: "improvement", text: "Documentacao: docs/ROADMAP.md, docs/AUTOMATIONS-ROADMAP.md e docs/IDEAS.md foram reescritos para refletir o estado real do produto e os proximos ciclos" },
      { type: "infra", text: "CI: novo smoke-production valida /login, /api/health e /api/monitor-openclaw apos os deploys automaticos" },
      { type: "infra", text: "OpenClaw: gateway passou a usar a porta 3000 no container, alinhando o runtime com o proxy do Coolify e eliminando o 502 do monitor publico" },
    ],
  },
  {
    version: "2.9.7",
    date: "2026-03-14",
    title: "Smoke test em producao e hardening extra do OpenClaw",
    items: [
      { type: "improvement", text: "Producao: smoke test confirmou login, dashboard, /squad, /subscriptions, /personal-life/radio-monitor e /settings respondendo corretamente apos o ultimo deploy" },
      { type: "infra", text: "OpenClaw: entrypoint passou a exportar NODE_COMPILE_CACHE por padrao e OPENCLAW_NO_RESPAWN=1 para reduzir warnings e loops de respawn no container" },
      { type: "fix", text: "Documentacao permanente: CLAUDE.md foi alinhado com a chain atual Vertex Gemini -> Qwen -> Llama -> DeepSeek" },
    ],
  },
  {
    version: "2.9.6",
    date: "2026-03-14",
    title: "Roadmap saneado e warnings operacionais reduzidos",
    items: [
      { type: "fix", text: "Documentacao: docs/ROADMAP.md foi reescrito para refletir o estado atual do SaaS, remover referencias a openrouter_paid e eliminar segredos versionados" },
      { type: "infra", text: "OpenClaw: openclaw.json agora declara safeBinProfiles para curl, jq, date, echo e openclaw, alem de /usr/local/bin em safeBinTrustedDirs" },
      { type: "improvement", text: "Build: crm-pipeline removeu import morto de useRevalidator, limpando o warning simples do Vite" },
    ],
  },
  {
    version: "2.9.5",
    date: "2026-03-14",
    title: "OpenClaw operacional com cliente por CNPJ e processo por referencia",
    items: [
      { type: "feature", text: "OpenClaw: create_client agora aceita apenas CNPJ e tenta enriquecer automaticamente os dados do cliente antes de gravar no CRM" },
      { type: "feature", text: "OpenClaw: abrir_processo agora aceita cliente mais modal, com tipo import como padrao quando a operacao nao vier explicita" },
      { type: "feature", text: "OpenClaw: novo atualizar_processo permite ajustar status, observacoes, incoterm, valores e campos operacionais por referencia" },
      { type: "improvement", text: "OpenClaw: erros de duplicidade e ambiguidade passaram a voltar com details estruturados para desambiguacao rapida no Telegram" },
    ],
  },
  {
    version: "2.9.4",
    date: "2026-03-14",
    title: "Curadoria da raiz e documentos reorganizados",
    items: [
      { type: "improvement", text: "Documentacao historica foi movida para docs/history e os arquivos ativos ROADMAP, IDEAS e AUTOMATIONS-ROADMAP passaram a viver em docs/" },
      { type: "improvement", text: "Criar/Publicar Apps agora le e grava ideias em docs/IDEAS.md, preservando o fluxo apos a reorganizacao da pasta raiz" },
      { type: "infra", text: "Rotas mortas ui-concept-a, ui-concept-b e ui-concept-c foram removidas do app e o .gitignore passou a bloquear logs, artifacts e metadados do Windows" },
      { type: "infra", text: "Prompts auxiliares do OpenClaw e scripts remotos foram reposicionados para openclaw-gateway/prompts e scripts/" },
    ],
  },
  {
    version: "2.9.3",
    date: "2026-03-14",
    title: "Monitoramento do Coolify robusto para SaaS e OpenClaw",
    items: [
      { type: "infra", text: "CI/CD: parser do Coolify passou a ler JSON via stdin, evitando falha por argument list too long no monitoramento de deploy" },
      { type: "infra", text: "CI/CD: janela de espera foi ampliada para 45 tentativas no SaaS e 90 tentativas no OpenClaw" },
      { type: "improvement", text: "Operacao: deploy real do OpenClaw foi concluido em producao com imagem do commit d98e545 e o falso negativo ficou isolado ao monitor antigo" },
    ],
  },
  {
    version: "2.9.2",
    date: "2026-03-14",
    title: "OpenClaw publicado e migration 0009 aplicada",
    items: [
      { type: "infra", text: "Producao: migration 0009_amusing_celestials foi aplicada no banco do SaaS, liberando subscriptions, radio monitor expandido e provider varchar em ai_usage_logs" },
      { type: "infra", text: "OpenClaw: prompts internos ganharam changelog atualizado para refletir a stack multiagente, a nova chain de IA e o cron de update check" },
      { type: "improvement", text: "CI: workflow passou a forcar Node 24 para JavaScript actions e o upload do Playwright foi atualizado para actions/upload-artifact@v7" },
    ],
  },
  {
    version: "2.9.1",
    date: "2026-03-14",
    title: "Auto-deploy do OpenClaw no GitHub Actions",
    items: [
      { type: "infra", text: "CI/CD: workflow passou a ter jobs separados para deploy do SaaS e do OpenClaw via API do Coolify" },
      { type: "infra", text: "OpenClaw: deploy automatico agora roda apenas quando houver alteracao em openclaw-gateway/" },
      { type: "improvement", text: "CI: upload do relatorio Playwright atualizado para actions/upload-artifact@v5, removendo o aviso legado de Node 20" },
    ],
  },
  {
    version: "2.9.0",
    date: "2026-03-14",
    title: "Nova squad room, chain de IA e OpenClaw multiagente",
    items: [
      { type: "feature", text: "IA: cadeia principal do SAAS migrou para Vertex Gemini -> Qwen Free -> Llama Free -> DeepSeek R1 Free -> DeepSeek Direct" },
      { type: "feature", text: "OpenClaw: configuracao multiagente com AIrton, IAna, marIA, IAgo, IAra, SofIA, mAI e JULia, cada um com workspace proprio" },
      { type: "feature", text: "UI: nova rota /squad em estilo Pixel Room e novo modulo de Assinaturas com dashboard BRL/USD, CRUD e vencimento visual" },
      { type: "feature", text: "OpenClaw tools: novo endpoint ver_assinaturas e skills customizadas para comex, licitacoes e promocoes" },
      { type: "improvement", text: "Radio Monitor: radios agora aceitam site, telefone e WhatsApp com links clicaveis e modal de edicao completo" },
      { type: "infra", text: "Migration 0009_amusing_celestials criada para subscriptions, radio monitor e consolidacao do provider de AI usage em varchar" },
    ],
  },
  {
    version: "2.8.7",
    date: "2026-03-13",
    title: "Payload de countTokens do Gemini corrigido",
    items: [
      { type: "fix", text: "Gemini Free: countTokens agora envia o campo model no payload exigido pela API, eliminando o erro 400 estrutural" },
      { type: "improvement", text: "Validacao operacional: smoke tests confirmaram Groq ativo e Gemini autenticando corretamente antes de bater no limite de quota da conta" },
    ],
  },
  {
    version: "2.8.6",
    date: "2026-03-13",
    title: "Gemini Free otimizado e coverage da CI padronizado",
    items: [
      { type: "improvement", text: "Gemini Free: prompts agora usam blocos XML de system, context e task para reduzir ruido e separar melhor cada parte do pedido" },
      { type: "improvement", text: "Gemini Free: countTokens passou a rodar antes do envio, com resumo preventivo de contexto longo e Flash-Lite reservado a chat/telegram simples" },
      { type: "infra", text: "CI: GitHub Actions atualizado para checkout, setup-node e Codecov v5" },
      { type: "infra", text: "CI: suite unit agora gera coverage-final.json antes do upload para Codecov quando CODECOV_TOKEN estiver configurado" },
    ],
  },
  {
    version: "2.8.5",
    date: "2026-03-13",
    title: "Autenticacao, chat e NCM estabilizados para CI",
    items: [
      { type: "fix", text: "Chat: popup ganhou role dialog, campo Mensagem com aria-label e indicador de digitacao com role status" },
      { type: "fix", text: "CRM: InputField passou a ligar label e input por htmlFor/id, restaurando acessibilidade e seletores E2E" },
      { type: "fix", text: "Autenticacao e auditoria: login_failed sem UUID invalido e lockout passa a contar apenas falhas reais de login" },
      { type: "fix", text: "NCM: classificacao voltou para a cadeia free-first sem DeepSeek obrigatorio e agora falha com timeout controlado" },
    ],
  },
  {
    version: "2.8.4",
    date: "2026-03-13",
    title: "Seletores E2E desacoplados de traducao",
    items: [
      { type: "fix", text: "Playwright: login E2E passou a usar input[name=email|password] e button[type=submit]" },
      { type: "fix", text: "Playwright local: webServer padronizado na porta 3000 para evitar timeout fora do CI" },
    ],
  },
  {
    version: "2.8.3",
    date: "2026-03-13",
    title: "E2E alinhado com login atual",
    items: [
      { type: "fix", text: "Playwright: credenciais E2E alinhadas ao seed atual (luiz@lhfex.com.br / lhfex2025!)" },
      { type: "fix", text: "Playwright: seletores do login atualizados para a UI atual da pagina /login" },
    ],
  },
  {
    version: "2.8.2",
    date: "2026-03-13",
    title: "Playwright em CI usando start do build",
    items: [
      { type: "fix", text: "E2E: Playwright passou a iniciar npm run start no CI em vez de npm run dev" },
      { type: "infra", text: "E2E: reuseExistingServer fica desativado em CI para evitar timeout silencioso no webServer" },
    ],
  },
  {
    version: "2.8.1",
    date: "2026-03-13",
    title: "Estabilidade de CI, seeds e fluxos auxiliares",
    items: [
      { type: "fix", text: "CI: typecheck limpo e seeds alinhados ao companyId obrigatorio" },
      { type: "fix", text: "OpenClaw: tools e Telegram corrigidos para companyId, timeline e referencia por modal" },
      { type: "fix", text: "Financeiro e notificacoes: UUIDs, contatos e importacao ajustados para o schema atual" },
      { type: "infra", text: "Documentacao operacional consolidada sem segredos e prompt temporario removido do repo" },
    ],
  },
  {
    version: "2.8.0",
    date: "2026-03-12",
    title: "Novo formato de referencia de processos por modal",
    items: [
      { type: "feature", text: "Processos: referencias agora seguem o formato A26-001, M26-001 e C26-001" },
      { type: "improvement", text: "Processos: sequencia reinicia por modal dentro do ano corrente" },
      { type: "fix", text: "Processos: remocao dos registros de teste IMP-2026-0001 e A26002 da base" },
    ],
  },
  {
    version: "2.6.4",
    date: "2026-03-09",
    title: "Pacote único de correções críticas e melhorias operacionais",
    items: [
      { type: "fix", text: "Automações: loader resiliente com fallback por seção para eliminar 500 total da página" },
      { type: "fix", text: "Processos: criação com normalização de campos numéricos e mensagem de erro explícita ao usuário" },
      { type: "fix", text: "Promoções/Loterias: feedback de erro visível e fechamento de formulário somente após sucesso" },
      { type: "feature", text: "CRM: edição de contato disponível após cadastro, direto na tela do cliente" },
      { type: "feature", text: "Calculadora COMEX: distribuição Multi-NCM com alíquotas individuais de II, IPI, PIS e COFINS" },
      { type: "improvement", text: "OpenClaw: removida referência a modelo inválido e exemplos com URL real do SAAS" },
    ],
  },
  {
    version: "2.6.3",
    date: "2026-03-07",
    title: "Estabilidade em produção + Vida Pessoal limpa + Dólar/IA refinados",
    items: [
      { type: "fix", text: "Hardening adicional contra 500 em /automations, /settings e /processes/cost-report" },
      { type: "improvement", text: "Vida Pessoal: removidos cards de resumo fictícios e bloco de Automação Pessoal da home" },
      { type: "improvement", text: "Vida Pessoal: módulos reorganizados por grupos e novo acesso de Saúde em /personal-life/health" },
      { type: "improvement", text: "Saúde: foco reforçado em peso e medidas corporais (tipos e unidades)" },
      { type: "improvement", text: "Dashboard: cotação passa a consumir /api/exchange-rate com fonte exibida no card" },
      { type: "improvement", text: "API de câmbio: AwesomeAPI como primária e PTAX como fallback/referência" },
      { type: "fix", text: "IA Usage: DeepSeek permanece visível no breakdown mesmo com baixo volume e providers desconhecidos não quebram UI" },
      { type: "improvement", text: "Sidebar: removida duplicidade de 'Conhecimento IA' fora do contexto de IA Agentes" },
    ],
  },
  {
    version: "2.6.2",
    date: "2026-03-07",
    title: "Modelo de Custos por Processo + Relatorio Operacional",
    items: [
      { type: "feature", text: "Processos: novo controle de custos por processo (habilitar, custo estimado, custo real e observacoes)" },
      { type: "feature", text: "Processos: novo relatorio /processes/cost-report com consolidado de custos e variacao" },
      { type: "improvement", text: "Criacao de processos sem etapa de aprovacao manual obrigatoria (fluxo inicia em rascunho)" },
      { type: "infra", text: "Migration 0006_process_costs.sql aplicada com campos de custo na tabela processes" },
      { type: "fix", text: "Validador de processos ajustado para parse correto de costControlEnabled em formularios" },
    ],
  },
  {
    version: "2.6.1",
    date: "2026-03-07",
    title: "Estabilidade 500 + Reorganizacao IA/Automacoes + Loterias + Ex-Tarifarios",
    items: [
      { type: "fix", text: "Hardening contra 500 em promotions/automations/api.promotions com tratamento de erro controlado" },
      { type: "improvement", text: "Automações agora concentra Mission Control + Crons; Agents focado em Agentes + Conhecimento" },
      { type: "improvement", text: "Settings: Changelog acima de Audit Logs e remoção do Prompt Guide duplicado" },
      { type: "feature", text: "Promoções: nova aba Loterias com fluxo manual (cadastrar, conferir, ganhar/encerrar sem ganho)" },
      { type: "feature", text: "Comex: nova página Ex-Tarifarios com consulta da fonte oficial do MDIC" },
      { type: "feature", text: "Outros: nova área Criar/Publicar Apps com gravação de ideias no IDEAS.md" },
      { type: "improvement", text: "Settings APIs: links operacionais adicionados para Groq e AwesomeAPI" },
      { type: "infra", text: "Migration 0005_personal_lotteries.sql adicionada para suporte às loterias" },
    ],
  },
  {
    version: "2.3.0",
    date: "2026-03-03",
    title: "Slate Pro Redesign + OpenClaw 2.0 + Faturamento Profissional",
    items: [
      { type: "improvement", text: "Redesign completo 'Slate Pro': sidebar escura, cards compactos, tipografia moderna" },
      { type: "improvement", text: "Logo circular no login e favicon atualizado para logo-circle.png" },
      { type: "feature",     text: "Dashboard: cotação PTAX BCB exibe data de atualização ('PTAX BCB · DD/MM/YYYY')" },
      { type: "feature",     text: "Dia Limpo: tracker de streak pessoal com grade estilo GitHub contributions (12 meses)" },
      { type: "feature",     text: "Faturamento: template profissional de fatura de cobrança com branding LHFEX" },
      { type: "feature",     text: "Faturamento: botão 'Enviar por Email' no detalhe da fatura (dados Banco Inter incluídos)" },
      { type: "feature",     text: "OpenClaw 2.0: hierarquia 4 camadas (Gemini free → openrouter/auto → DeepSeek → OR pago)" },
      { type: "feature",     text: "OpenClaw: quiet hours 00h–05h (silêncio noturno com bypass por palavras urgentes)" },
      { type: "improvement", text: "SOUL.md: regra absoluta 'NUNCA MINTA', capacidades reais documentadas com ✅/⚠️/❌" },
      { type: "feature",     text: "Telegram bot: suporte a mensagens de voz/áudio via Groq Whisper transcription" },
      { type: "feature",     text: "Telegram bot: suporte a imagens via Gemini Vision 2.0 Flash analysis" },
      { type: "feature",     text: "Heartbeats: 6 novos crons (update-check, VPS diário, personal morning, briefing LHFEX, weekly, promoções)" },
      { type: "infra",       text: "Env vars: GROQ_API_KEY, INTER_CLIENT_ID/SECRET/ACCOUNT, OPENCLAW_TOOLS_API_KEY configurados no Coolify" },
    ],
  },
  {
    version: "2.2.3",
    date: "2026-02-22",
    title: "Rotas nativas Vida Pessoal + Compatibilidade Legada",
    items: [
      { type: "improvement", text: "Rotas /personal-life/finances, /accounts, /transactions, /budgets e /recurring agora são nativas (sem wrappers de redirect)" },
      { type: "improvement", text: "Rota /personal-life/promotions agora contém implementação completa do módulo" },
      { type: "improvement", text: "Rota /personal-life/radio-monitor agora contém implementação completa do módulo" },
      { type: "feature",     text: "Compatibilidade mantida: URLs legadas /firefly-*, /company-promotions e /radio-monitor redirecionam para os novos caminhos" },
      { type: "fix",         text: "Arquitetura de rotas consolidada para evitar dependência de wrappers e facilitar manutenção futura" },
    ],
  },
  {
    version: "2.2.2",
    date: APP_RELEASE_DATE,
    title: "Reestruturação Vida Pessoal + Firefly Completo",
    items: [
      { type: "feature",     text: "Firefly virou módulo oficial de Finanças Pessoais em /personal-life/finances" },
      { type: "feature",     text: "Finanças Pessoais completo: dashboard + contas + lançamentos + orçamentos + recorrências" },
      { type: "feature",     text: "Promoções e Sorteios movido para /personal-life/promotions" },
      { type: "feature",     text: "Radio Monitor movido para /personal-life/radio-monitor" },
      { type: "improvement", text: "Hub Vida Pessoal atualizado: removido Férias & Descanso e substituído por Radio Monitor" },
      { type: "improvement", text: "Navegação lateral/mobile simplificada com módulos pessoais centralizados em Vida Pessoal" },
    ],
  },
  {
    version: "2.2.1",
    date: "2026-02-22",
    title: "Correções Críticas e Notificações Aprimoradas",
    items: [
      { type: "fix",         text: "CRM: campo Nome Fantasia agora limpa corretamente ao enriquecer CNPJ" },
      { type: "fix",         text: "Google OAuth: corrigido erro 405 ao iniciar autenticação" },
      { type: "feature",     text: "Notificações: página dedicada com 50 itens e marcar como lida" },
      { type: "feature",     text: "Telegram: integração com notificações de vencimentos, processos e changelog" },
      { type: "feature",     text: "CRM: LHFEX adicionada como cliente interno (CNPJ 62.180.992/0001-33)" },
      { type: "improvement", text: "Dashboard: link 'Ver todas' no widget de notificações" },
    ],
  },
  {
    version: "2.2.0",
    date: "2026-02-22",
    title: "Expansão Completa: Cadastros, IA Marketing e Contabilidade",
    items: [
      { type: "fix",         text: "Taxa do dolar agora usa Banco Central (serie 10813 - USD Importacao)" },
      { type: "feature",     text: "Auto-enriquecimento CNPJ via ReceitaWS no carregamento de Settings" },
      { type: "improvement", text: "Perfil da Empresa com UI compacta e modal expansivel (18 campos)" },
      { type: "feature",     text: "Suporte a multiplas contas bancarias (schema company_bank_accounts)" },
      { type: "feature",     text: "OpenCLAW: orquestrador de bot Telegram para promocoes e sorteios" },
      { type: "feature",     text: "Radio Monitor: sistema de monitoramento de promocoes em radios com transcricao" },
      { type: "feature",     text: "Firefly Phase 1: contabilidade triple-entry (contas, transacoes, orcamentos)" },
    ],
  },
  {
    version: "2.1.0",
    date: "2026-02-21",
    title: "Infraestrutura, IA e Segurança",
    items: [
      { type: "infra",       text: "Redis (Upstash) integrado para cache e sessoes distribuidas" },
      { type: "infra",       text: "CI/CD completo: lint, testes e deploy automatico via GitHub Actions" },
      { type: "improvement", text: "78 erros TypeScript corrigidos — codigo 100% tipado" },
      { type: "feature",     text: "Life Agent MVP ativado com automacao de vida pessoal" },
      { type: "improvement", text: "Chat estabilizado com telemetria e metricas de IA por provider" },
      { type: "feature",     text: "Rate limiting por feature: login, chat, OCR, CNPJ" },
      { type: "fix",         text: "Dependencia @sentry/remix incompativel com React 19 removida" },
    ],
  },
  {
    version: "2.0.1",
    date: "2026-02-21",
    title: "Aurora UI + Login + Deploy visivel",
    items: [
      { type: "improvement", text: "Tema Aurora aplicado no layout (sidebar, topbar, mobile)" },
      { type: "improvement", text: "Tela de login com logo maior e visual alinhado ao novo tema" },
      { type: "feature", text: "Previews de UI (A/B/C) publicados para comparacao" },
      { type: "fix", text: "Correcoes de compatibilidade do React Router no runtime" },
    ],
  },
  {
    version: "2.0.0",
    date: "2026-02-20",
    title: "Compras Publicas + Vida Pessoal",
    items: [
      { type: "feature", text: "Modulo de Compras Publicas com editais, processos e alertas" },
      { type: "feature", text: "Vida Pessoal com financas, investimentos, rotinas e metas" },
      { type: "improvement", text: "RBAC por email e navegacao atualizada" },
      { type: "infra", text: "Config de versao centralizada em app/config/version.ts" },
    ],
  },
];
