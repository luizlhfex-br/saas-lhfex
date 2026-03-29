/**
 * GET /changelog
 * Log de atualizações do sistema LHFEX SaaS
 * Mantido manualmente — registra cada deploy/feature relevante
 */

import type { Route } from "./+types/changelog";
import { requireAuth } from "~/lib/auth.server";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { ArrowLeft, GitCommit, Zap, Bug, Wrench, Star } from "lucide-react";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  return {};
}

type ChangeType = "feat" | "fix" | "refactor" | "docs" | "release";

type Entry = {
  date: string;
  version?: string;
  commit?: string;
  type: ChangeType;
  title: string;
  items: string[];
};

const CHANGELOG: Entry[] = [
  {
    date: "2026-03-28",
    version: "2.9.60",
    type: "release",
    title: "Referencias anuais unificadas e pipeline comercial mais enxuto",
    items: [
      "As referencias de processos agora seguem uma numeracao anual unica por empresa, compartilhada entre A, M e C e reiniciada apenas quando muda o ano",
      "O tipo services passou a ser exibido como Outros na criacao, edicao, detalhe e listagem, evitando a leitura errada de exportacao quando o processo for de outra natureza",
      "A Calculadora Comex vinculada ao processo ganhou botao de salvar no processo, feedback de sincronizacao e atalho direto para a Memoria de Impostos",
      "O CRM Pipeline juntou Proposta e Negociacao na mesma coluna, e as tools do SaaS/Hermes passaram a refletir essa leitura simplificada do funil",
    ],
  },
  {
    date: "2026-03-28",
    version: "2.9.59",
    type: "release",
    title: "Memoria de impostos por processo de importacao",
    items: [
      "Processos: o detalhe do embarque ganhou um atalho proprio para a Memoria de Impostos, visivel apenas quando o processo for de importacao",
      "Importacao: nova rota de fechamento tributario permite salvar parametros, itens da invoice, despesas na base do ICMS e despesas finais do processo dentro do proprio embarque",
      "Calculo: o resumo trabalha com rateio por peso liquido, consolidacao por NCM e separacao entre custo de importacao e custo final do processo",
      "Schema: a migration 0021_process_tax_memory.sql adicionou process_tax_workbooks, process_tax_items e process_tax_expenses",
    ],
  },
  {
    date: "2026-03-28",
    version: "2.9.58",
    type: "release",
    title: "Painel lateral do pipeline estabilizado",
    items: [
      "A coluna lateral do CRM Pipeline passou a usar largura minima propria, impedindo que Agenda comercial e Como usar fiquem esmagados quando o quadro principal precisa rolar horizontalmente",
      "Os paineis operacionais agora assumem min-w-0 por padrao, reduzindo outros riscos de texto comprimido em grids com conteudo largo",
    ],
  },
  {
    date: "2026-03-28",
    version: "2.9.57",
    type: "release",
    title: "Pipeline comercial simplificado e integrado ao Hermes",
    items: [
      "O CRM Pipeline foi reconstruido com 5 colunas visiveis - Lead, Proposta, Negociacao, Fechado e Perdido - escondendo a etapa legacy de qualification dentro de Lead para reduzir complexidade operacional",
      "Deals agora carregam companyId, proxima acao, data de follow-up e motivo de perda, com agenda comercial na tela e consultas filtradas corretamente por empresa",
      "O endpoint do SaaS ganhou actions para listar, criar, atualizar, mover, ganhar, perder e registrar follow-up de deals, abrindo o caminho para operacao real pelo Hermes Agent no Telegram",
      "A skill lhfex-saas do Hermes foi atualizada para tratar pipeline como modulo de negocio de primeira classe, incluindo atalhos de criacao, movimentacao e leitura do funil",
    ],
  },
  {
    date: "2026-03-28",
    version: "2.9.56",
    type: "release",
    title: "CRM sem tipagem rigida de importador e exportador",
    items: [
      "O CRM deixou de exibir o campo legado de tipo na listagem e no detalhe, evitando rotulos que hoje nao representam bem clientes, parceiros, transportadoras e outros perfis da carteira",
      "Os fluxos manuais de novo cliente e edicao deixaram de forcar clientType='importer' em todo salvamento, reduzindo classificacao incorreta sem criar migracao desnecessaria agora",
      "A acao criar_cliente usada pelo Hermes Agent passou a enviar clientType apenas quando o dado for informado explicitamente, mantendo esse campo legado inativo por padrao",
    ],
  },
  {
    date: "2026-03-28",
    version: "2.9.55",
    type: "release",
    title: "Diagnostico de versao e heartbeat do Hermes Agent",
    items: [
      "O endpoint system_status do SaaS passou a separar agentRuntime, hermesVersion e legacyOpenclawVersion para evitar que o runtime Hermes pareca ser a versao do OpenClaw legado",
      "O cron hermes_heartbeat foi reorientado para buscar a versao real do Hermes no VPS, usar essa evidencia no resumo e tratar heartbeat como sucesso apenas quando o POST retorna success e heartbeatId",
      "As skills lhfex-runtime e lhfex-saas agora proíbem relatar 401 ou chave truncada sem status e corpo reais do endpoint",
    ],
  },
  {
    date: "2026-03-28",
    version: "2.9.54",
    type: "release",
    title: "Correcao do enriquecimento manual no CRM",
    items: [
      "A acao Enriquecer com IA nas telas de detalhe e edicao do CRM voltou a redirecionar corretamente depois do sucesso, em vez de cair no banner de erro falso",
      "O banner de confirmacao por parametro enriched=1 volta a aparecer como previsto quando o cadastro e atualizado pelo enriquecimento do CNPJ",
    ],
  },
  {
    date: "2026-03-28",
    version: "2.9.53",
    type: "release",
    title: "Enriquecimento automatico de CNPJ no CRM e Hermes Agent",
    items: [
      "Novo cliente: ao informar um CNPJ valido, o CRM agora tenta enriquecer o cadastro automaticamente antes de salvar, preenchendo razao social, nome fantasia, CNAE e endereco quando a consulta retorna dados",
      "Cliente ja cadastrado: as telas de detalhe e edicao passaram a manter a acao Enriquecer com IA, permitindo atualizar os dados cadastrais depois do cadastro inicial sem perder o fluxo",
      "Hermes Agent: a acao criar_cliente agora tenta enriquecer qualquer CNPJ valido enviado no Telegram, mesmo que o pedido venha so com o documento ou com dados parciais",
      "As skills do runtime Hermes foram corrigidas para nao pedir OPENCLAW_TOOLS_API_KEY quando o acesso ao SaaS ja foi validado pelo catalogo de acoes",
    ],
  },
  {
    date: "2026-03-26",
    version: "2.9.52",
    type: "release",
    title: "Radar de promocoes com monitor Instagram e amigos autorizados",
    items: [
      "A aba Insta de Promocoes ganhou um radar proprio com painel para fontes monitoradas, amigos autorizados, descoberta por URL e fila de importacao",
      "Descobertas de links do Instagram ou campanhas agora geram score, resumo das regras, prazo, sugestao de amigos para marcar e acao direta para importar na lista principal",
      "A nova lista de amigos autorizados passou a controlar handle, prioridade e limites diarios e semanais para rodizio de marcacoes",
      "A migration 0019_promotion_monitoring.sql criou as tabelas promotion_watch_sources, promotion_tag_friends, promotion_discoveries e promotion_tag_friend_usage",
    ],
  },
  {
    date: "2026-03-26",
    version: "2.9.51",
    type: "release",
    title: "Radar de noticias com digest no SaaS e Telegram",
    items: [
      "Vida Pessoal ganhou o modulo Noticias para organizar o radar diario de IA, BH, mundo e comercio exterior em um unico painel",
      "O digest diario pode ser gerado manualmente dentro do SaaS e tambem enviado pelo cron news_daily_digest diretamente no Telegram",
      "Fontes padrao, leitura por item, favoritos e historico dos ultimos digests passaram a ficar persistidos no banco",
      "A migration 0018_personal_news_digest.sql criou as tabelas personal_news_sources, personal_news_items e personal_news_digests para sustentar o modulo",
    ],
  },
  {
    date: "2026-03-26",
    version: "2.9.50",
    type: "release",
    title: "Fluxo de caixa PJ com previsto, realizado e saldo projetado",
    items: [
      "Financeiro PJ: o controle de caixa foi reconstruido para operar com lancamentos previstos, baixas liquidadas, cancelamentos e saldo projetado do periodo",
      "A tela principal de fluxo de caixa agora mostra saldo de abertura, entradas e saidas liquidadas, pendencias, atrasos e tabela com acumulado por movimento",
      "Cadastro manual e importacao CSV passaram a aceitar status de previsto, liquidado e cancelado, incluindo baixa automatica quando o lancamento entra como realizado",
      "A migration 0017_cashflow_status.sql adicionou o campo status em cash_movements para separar previsao, realizado e cancelamento no caixa da LHFEX",
    ],
  },
  {
    date: "2026-03-26",
    version: "2.9.49",
    type: "release",
    title: "Financas pessoais com metas, contas a pagar e previsto x realizado",
    items: [
      "Financas Pessoais: a tela principal foi refeita para concentrar receitas, despesas previstas, pagamentos realizados, metas do mes e saldo projetado em um unico fluxo",
      "Financas Pessoais: contas previstas agora podem ser marcadas como pagas, exibidas como vencidas quando atrasam e organizadas ao lado dos lancamentos recentes",
      "O dashboard pessoal passou a mostrar resumo do mes, grafico de receitas x despesas e distribuicao de gastos por categoria sem depender das subrotas antigas",
      "A migration 0016_personal_finance_planning.sql adicionou status, quitacao, recorrencia fixa e a tabela personal_finance_goals para planejamento mensal",
    ],
  },
  {
    date: "2026-03-26",
    version: "2.9.48",
    type: "release",
    title: "Saude corporal com fotos, metricas e historico por snapshot",
    items: [
      "Saude: o modulo virou uma avaliacao corporal completa com snapshots por data, peso, altura, medidas, observacoes e calculos de IMC, gordura corporal, massa magra, TMB e calorias diarias",
      "Saude: cada medicao agora aceita fotos de frente, lado e costas, com galeria agrupada por pose e edicao rapida pelo historico",
      "UI: a tela foi refeita como um painel visual de acompanhamento corporal com cards de resumo, guia ilustrado de medidas e historico grafico por indicador",
      "Schema: a migration 0015_personal_health_assessments.sql foi aplicada para sustentar as novas tabelas personal_health_assessments e personal_health_photos",
    ],
  },
  {
    date: "2026-03-26",
    version: "2.9.47",
    type: "release",
    title: "Auditoria geral com hardening das automacoes e naming Hermes",
    items: [
      "Webhook de automacoes agora exige assinatura HMAC, payload validado com Zod, rate limit e trilha de auditoria para chamadas negadas ou aceitas",
      "Rotas de cron e automacoes foram endurecidas com companyId, userId e allowlist de admins mais explicita, reduzindo risco de vazamento entre escopos",
      "Os testes E2E de auth e chat foram estabilizados no fluxo atual, incluindo o caminho de classificacao controlado para evitar falha externa intermitente",
      "Branding ativo do SaaS foi alinhado para Hermes Agent e o repositorio ganhou a base `.specify` para planejar epicos maiores com menos improviso",
    ],
  },
  {
    date: "2026-03-21",
    version: "2.9.46",
    type: "release",
    title: "Estabilizacao do redesign operacional e liberacao da pipeline",
    items: [
      "CRM: o E2E passou a submeter o formulario novo de forma escopada, removendo a ambiguidade do novo hero com acao de salvar",
      "Processos e Financeiro: carregamento de clientes e sequencia da nova fatura voltaram a respeitar companyId",
      "Detalhes e formularios operacionais receberam uma passada extra de consistencia visual nos blocos de custos, documentos e resumo financeiro",
    ],
  },
  {
    date: "2026-03-21",
    version: "2.9.45",
    type: "release",
    title: "Redesign operacional dos fluxos de detalhe e formularios",
    items: [
      "CRM: detalhe, novo cliente e edicao passaram a usar hero operacional, paineis de contexto e formularios alinhados ao novo design system",
      "Processos e Financeiro: fluxos de detalhe e formularios ganharam a mesma linguagem visual da fase 2, aproximando os modulos core da base do futuro v3.0",
      "UI compartilhada: novo operational-page centraliza hero, estatisticas e paineis reutilizados nas telas operacionais",
      "Processos: o OCR deixou de disparar toast durante o render e agora notifica apenas quando o resultado muda de fato",
    ],
  },
  {
    date: "2026-03-21",
    version: "2.9.44",
    type: "release",
    title: "Seletores E2E alinhados ao redesign do CRM",
    items: [
      "Playwright: o teste de navegacao do CRM passou a usar o heading principal exato da pagina, evitando ambiguidade com os novos blocos do redesign",
      "Validacao local: a suite E2E foi reexecutada em modo equivalente ao CI com 20 testes passando em worker unico",
    ],
  },
  {
    date: "2026-03-21",
    version: "2.9.43",
    type: "release",
    title: "Redesign operacional do shell, dashboard e modulos core",
    items: [
      "Layout: app shell, topbar, sidebar e navegacao mobile ganharam linguagem visual de centro de comando, com hierarquia mais forte para o uso diario",
      "Dashboard: home virou uma sala de controle com hero operacional, radar financeiro, infraestrutura e agentes em leitura mais objetiva",
      "CRM, Processos e Financeiro foram redesenhados com hero por modulo, filtros mais claros e superficies alinhadas ao novo design system",
      "Vite local passou a deduplicar React e o dashboard trocou os wrappers responsivos dos graficos por medicao direta, estabilizando a validacao visual no WSL",
    ],
  },
  {
    date: "2026-03-20",
    version: "2.9.42",
    type: "release",
    title: "Parte 20 aplicada com base visual e IAra turbinada",
    items: [
      "Frontend: nova base de design tokens em app/styles/tokens.css com foco unificado, tokens semanticos e componentes de superficie",
      "UI compartilhada: button, input, modal e dropdown passaram a usar foco padronizado e melhor suporte de teclado",
      "Hermes Gateway: IAra ganhou a skill local lhfex-frontend-design para redesign, UX, design system e frontend operacional",
      "Docs: novo plano docs/FRONTEND-REDESIGN-PLAN.md organiza o redesign completo do SaaS por fases, camadas e modulos",
    ],
  },
  {
    date: "2026-03-20",
    version: "2.9.41",
    type: "release",
    title: "Hermes squad calibrado com playbooks e roteamento operacional",
    items: [
      "Hermes Gateway: novo SQUAD-PLAYBOOKS versiona matriz de primeira acao, playbooks por intent e contrato minimo de saida do squad",
      "SOUL, AGENTS e a skill lhfex-squad-router passaram a impor gating entre runtime, SaaS e delegacao antes de chamar especialistas",
      "Os perfis dos 8 especialistas agora declaram primeira acao, saida esperada, anti-padroes e escalacoes comuns por dominio",
      "Skills lhfex-saas e lhfex-runtime trocaram source por . /root/.hermes/.env para funcionar corretamente no shell real do Hermes",
    ],
  },
  {
    date: "2026-03-20",
    version: "2.9.40",
    type: "release",
    title: "Parte 19 aplicada ao Hermes com engenharia avancada de agentes",
    items: [
      "Hermes Gateway: novos artefatos AGENTS, TRAINING e LEARNED_RULES para orquestracao, contexto iceberg e aprendizado continuo",
      "Hermes Skills: nova skill lhfex-agent-engineering para DoD, verification loop, reverse prompting e manutencao de learned rules",
      "Hermes Runtime: sync e bootstrap preservam LEARNED_RULES vivo no VPS e garantem cron semanal de revisao das regras aprendidas",
      "Skills do SaaS e runtime foram endurecidas para sessoes ad hoc com env e PATH inconsistentes no sandbox do Hermes",
    ],
  },
  {
    date: "2026-03-20",
    version: "2.9.39",
    type: "release",
    title: "Monitor de producao adaptado ao runtime Hermes",
    items: [
      "Monitor do agente agora faz fallback para a observabilidade do SaaS quando o health HTTP legado do gateway nao representa o Hermes",
      "Smoke production deixa de marcar o runtime como offline apenas porque o endpoint /health legado responde 404",
      "A resposta do monitor passa a informar source, gatewayProbe e heartbeat recente para diagnostico mais util",
    ],
  },
  {
    date: "2026-03-20",
    version: "2.9.38",
    type: "release",
    title: "Hermes em producao com diagnostico operacional confiavel",
    items: [
      "Hermes: nova skill lhfex-runtime para diagnosticar provider, modelo, acesso ao SaaS, Google, Telegram e host com evidencia real",
      "SOUL e skill SAAS do Hermes agora validam catalogo_acoes e hermes status antes de responder sobre acesso ou LLM em uso",
      "Bootstrap, runbook e checklist do Hermes foram alinhados ao runtime estavel com DeepSeek primario e MiniMax free como fallback",
      "Gateway Hermes permaneceu ativo no VPS apos sincronizacao do contexto, mantendo o OpenClaw antigo preservado para rollback",
    ],
  },
  {
    date: "2026-03-20",
    version: "2.9.37",
    type: "release",
    title: "Hermes Agent preparado no VPS com bridge SaaS e Google",
    items: [
      "Hermes: novo pacote hermes-gateway com SOUL, runbook, cutover checklist, bootstrap idempotente e skills LHFEX no formato SKILL.md",
      "OpenClaw Tools: actions google_status, google_buscar_drive, google_criar_evento_calendario e google_criar_planilha adicionadas para operar Google via SaaS",
      "Hermes no VPS: release v2026.3.17 instalada, Telegram configurado, fallback DeepSeek validado e cron jobs registrados sem derrubar o OpenClaw atual",
      "Skill SAAS do gateway atualizada para refletir o bridge Google e o contrato operacional comum entre OpenClaw e Hermes",
    ],
  },
  {
    date: "2026-03-19",
    version: "2.9.36",
    type: "release",
    title: "OpenClaw com acesso SaaS mais confiavel no Telegram",
    items: [
      "AIrton: SOUL e AGENTS reforcados para usar /api/openclaw-tools em consultas de negocio, evitando confusao com processos internos do runtime",
      "OpenClaw Gateway: fallback free principal passou para openrouter/minimax/minimax-m2.5:free, mantendo openrouter/free como fallback adicional",
      "AIrton: regra operacional para nao pedir URL/token ao Luiz quando a consulta for do SaaS LHFEX",
      "AIrton: transparencia de provider/model reforcada para responder qual LLM esta em uso quando solicitado",
    ],
  },
  {
    date: "2026-03-19",
    version: "2.9.35",
    type: "release",
    title: "OpenClaw estabilizado no SaaS com catalogo de tools expandido",
    items: [
      "OpenClaw Gateway: provider principal corrigido para google-vertex/gemini-2.0-flash, removendo erro de modelo desconhecido no runtime",
      "OpenClaw Gateway: heartbeat interno foi desligado no openclaw.json para parar tentativas de envio para @heartbeat",
      "OpenClaw Tools: novo action catalogo_acoes com mapa completo de GET/POST e exemplos prontos para uso",
      "OpenClaw Tools: novos actions resumo_modulos_saas, listar_faturas e listar_radios para ampliar consulta operacional via Telegram",
      "JULia: skill musa-literaria registrada como exclusiva do modulo Literario e integrada ao fluxo de promocoes",
    ],
  },
  {
    date: "2026-03-19",
    version: "2.9.34",
    type: "release",
    title: "Calculadora COMEX com conversao de invoice e taxa Siscomex por adicao",
    items: [
      "Calculadora: nova conversao de invoice por moeda para USD via endpoint proprio, com taxa e fonte exibidas na tela",
      "Siscomex: taxa passou a ser calculada por quantidade de adicoes de NCM, carregando tabela versionada em data/siscomex",
      "NCM por distribuicao: linhas agora incluem ICMS por item, ampliacao visual do bloco e resumo FOB por somatorio real das adicoes",
      "COMEX: labels operacionais foram padronizadas para Honorario Despachante, Taxa Siscomex e Dias de Free Time",
    ],
  },
  {
    date: "2026-03-18",
    version: "2.9.33",
    type: "release",
    title: "Settings com cadastro enriquecido da empresa e contas extras",
    items: [
      "Settings: o bloco da empresa passou a editar contato principal, cargo, registro profissional e titular da conta principal",
      "Settings: contas bancarias adicionais agora podem ser criadas, editadas e excluidas na propria tela",
      "API e schema do company profile foram alinhados para persistir contato enriquecido e titular bancario sem atualizar tudo de forma cega",
      "Cadastro interno da LHFEX foi preenchido com CNPJ, endereco, contato e conta Inter para a tela nao abrir mais como CNPJ nao configurado",
    ],
  },
  {
    date: "2026-03-17",
    version: "2.9.32",
    type: "release",
    title: "Embeddings corrigidos para runtime de producao",
    items: [
      "@google/genai foi movido para dependencies para nao ser removido no prune do Docker e no runtime do Coolify",
      "OpenClaw: a base de memoria semantica volta a subir no container de producao sem erro de pacote ausente",
      "Deploy: a pipeline passa a publicar a imagem com a dependencia de embeddings disponivel no build final",
    ],
  },
  {
    date: "2026-03-17",
    version: "2.9.31",
    type: "release",
    title: "OpenClaw com memoria semantica e briefing operacional",
    items: [
      "Embeddings: o SaaS ganhou a fundacao vetorial com pgvector, jobs de indexacao e busca semantica por cliente, processo e documento",
      "Memoria: a nova tela de conhecimento semantico permite consultar contexto recuperado e acionar backfill inicial do CRM e dos processos",
      "OpenClaw: o cron operacional passou a gerar briefing diario com alertas, work items e resumo de saude do squad",
      "Observabilidade: o painel de agentes passou a exibir alertas recentes e informacoes mais ricas sobre o estado do squad",
    ],
  },
  {
    date: "2026-03-17",
    version: "2.9.30",
    type: "release",
    title: "Processos abrem com Todos os status por padrao",
    items: [
      "Processos: a tela inicial agora abre em Todos os status para dar visao geral do fluxo sem filtro aplicado",
      "Processos: o filtro continua funcionando normalmente para refinar a lista depois da visao geral inicial",
      "Processos: o estado padrao do select foi alinhado com a expectativa operacional de ver tudo primeiro",
    ],
  },
  {
    date: "2026-03-17",
    version: "2.9.29",
    type: "release",
    title: "OpenClaw com resposta de acesso mais segura e objetiva",
    items: [
      "OpenClaw: a resposta sobre acesso ao SaaS agora pede o minimo necessario e nao sugere senha em chat",
      "SOUL.md, AGENTS.md e a skill SAAS foram ajustados para priorizar API/tools e nao assumir browser/sessao sem validacao real",
      "IDENTITY.md foi refinado para remover a promessa de acesso total e deixar claro o contrato operacional real",
    ],
  },
  {
    date: "2026-03-17",
    version: "2.9.28",
    type: "release",
    title: "Briefing operacional diario do OpenClaw",
    items: [
      "OpenClaw: o cron diario passou a enviar um briefing operacional com saude dos agentes, work items, handoffs e falhas recentes",
      "/automations/overview agora exibe o Briefing Operacional OpenClaw na secao de cron jobs em producao",
      "OpenClaw: o briefing registra run e heartbeat na fundacao de observabilidade para manter a trilha auditavel",
    ],
  },
  {
    date: "2026-03-17",
    version: "2.9.27",
    type: "release",
    title: "OpenClaw com matriz de permissoes e playbooks por agente",
    items: [
      "OpenClaw: agents.catalog.json ganhou playbooks por agente, deixando claro como cada especialista deve agir em cenarios recorrentes",
      "/agents: a tela passou a exibir matriz de permissao, gatilhos, KPIs e playbooks principais de cada agente do squad",
      "SOUL.md e AGENTS.md agora tratam playbooks e matriz de permissao como parte do contrato operacional antes de delegar",
    ],
  },
  {
    date: "2026-03-17",
    version: "2.9.26",
    type: "release",
    title: "CSRF dos processos ajustado para proxy reverso",
    items: [
      "CSRF: a validacao same-origin passou a considerar X-Forwarded-Host e X-Forwarded-Proto, evitando falso expirado ao criar processo atras do Coolify",
      "Processos: o formulario de novo processo voltou a aceitar o POST normalmente em producao sem perder a protecao contra origem cruzada",
    ],
  },
  {
    date: "2026-03-17",
    version: "2.9.25",
    type: "release",
    title: "OpenClaw com observabilidade operacional por agente",
    items: [
      "OpenClaw: o SaaS ganhou tabelas para agent_runs, agent_heartbeats, agent_handoffs e agent_work_items com companyId e indexes proprios",
      "OpenClaw: /api/openclaw-tools passou a registrar heartbeat, run, handoff e work item do squad via actions dedicadas",
      "/agents: a tela virou painel operacional com resumo de heartbeats, runs, handoffs e work items recentes do OpenClaw",
      "OpenClaw: SOUL.md e AGENTS.md agora declaram as actions de observabilidade como parte oficial do fluxo do squad",
      "Schema: a fundacao foi registrada em drizzle/migrations/0011_openclaw_observability.sql para manter a base versionada",
    ],
  },
  {
    date: "2026-03-17",
    version: "2.9.24",
    type: "release",
    title: "Calculadora integrada ao detalhe do processo",
    items: [
      "Processos: a tela de detalhe ganhou atalhos diretos para abrir a calculadora ja com o contexto do embarque carregado",
      "Calculadora: agora aceita processId e modal na URL para pre-preencher FOB, NCM/HS, moeda e referencia do processo",
      "Calculadora: o card de contexto mostra referencia, cliente, tipo, incoterm, valor e um atalho para voltar ao processo original",
      "Calculadora: o reset voltou a respeitar os valores pre-carregados do processo, evitando perder o contexto operacional",
    ],
  },
  {
    date: "2026-03-17",
    version: "2.9.23",
    type: "release",
    title: "OpenClaw estruturado como squad operacional versionado",
    items: [
      "OpenClaw: agents.catalog.json passou a registrar dominio, responsabilidades, tools, permissoes, gatilhos e KPIs dos 8 agentes",
      "OpenClaw: cada agente ganhou README, SOUL, AGENTS, HEARTBEAT e WORKING proprios, deixando de depender so de IDENTITY.md",
      "Runtime: o entrypoint agora preserva WORKING.md entre restarts e copia o catalogo para os workspaces em execucao",
      "SaaS: a tela /agents passou a ler o catalogo estruturado e a mostrar arquivos operacionais, tools e proposito por agente",
      "Planejamento: docs/OPENCLAW-ARCHITECTURE-PLAN.md consolidou o plano de absorcao do awesome-openclaw-agents e docs/IDEAS.md guardou as referencias externas e o backlog de embeddings",
    ],
  },
  {
    date: "2026-03-17",
    version: "2.9.22",
    type: "release",
    title: "Google OAuth com client JSON, state valido e lookup correto de token",
    items: [
      "Google OAuth: o backend passou a aceitar GOOGLE_OAUTH_CLIENT_JSON_PATH como fonte local do client web baixado no Google Cloud",
      "Seguranca: o inicio do fluxo agora grava state em cookie httpOnly e o callback valida esse state antes de trocar o code por tokens",
      "Google OAuth: o redirect URI passou a ser resolvido pela origem da requisicao ou pelo APP_URL quando GOOGLE_REDIRECT_URI estiver vazio",
      "Integracao: a busca de token Google deixou de ignorar userId e voltou a consultar apenas o token ativo do usuario atual",
      "Docs: .env.example passou a documentar GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_CLIENT_JSON_PATH, GOOGLE_REDIRECT_URI e GOOGLE_DRIVE_FOLDER_ID",
    ],
  },
  {
    date: "2026-03-17",
    version: "2.9.21",
    type: "release",
    title: "Calculadora com resumo FOB e lookup de NCM mais visual",
    items: [
      "Calculadora: a distribuicao por NCM passou a mostrar o total FOB distribuido e a diferenca contra o FOB principal informado",
      "Calculadora: cada linha da distribuicao agora exibe codigo casado, tipo de match e base vigente quando o catalogo local encontra a NCM",
      "Lookup principal: o card de NCM passou a mostrar codigo casado, match exato ou por prefixo, base vigente e ato normativo da tabela",
      "Uso operacional: o retorno do lookup ficou mais visual para conferencia rapida sem precisar sair da calculadora",
    ],
  },
  {
    date: "2026-03-17",
    version: "2.9.20",
    type: "release",
    title: "Catalogo NCM local integrado ao lookup da calculadora",
    items: [
      "Calculadora: o lookup de NCM passou a consultar primeiro o arquivo local oficial em data/ncm antes de tentar descricao externa",
      "Backend: novo helper app/lib/ncm-catalog.server.ts carrega o JSON vigente mais recente e monta um indice em memoria por codigo e por prefixo pai",
      "Simulacao: a origem exibida na calculadora agora diferencia quando a descricao veio do catalogo NCM local somada a tabela estimada de aliquotas",
      "Operacao: o catalogo pode ser atualizado trocando o JSON em data/ncm, sem mexer de novo na regra do endpoint",
    ],
  },
  {
    date: "2026-03-17",
    version: "2.9.19",
    type: "release",
    title: "Calculadora com NCM automatico e distribuicao saneada",
    items: [
      "Calculadora: o bloco de distribuicao por NCM deixou de exibir texto corrompido e o duplicado morto foi removido da rota",
      "Calculadora: o campo principal de NCM agora consulta automaticamente as aliquotas estimadas de II, IPI, PIS e COFINS enquanto o codigo e digitado",
      "Calculadora: cada linha da distribuicao por NCM passou a buscar a previsao de aliquotas, descricao e fonte sem depender de preenchimento manual completo",
      "Simulacao: as aliquotas continuam editaveis apos o autopreenchimento para permitir ajuste operacional sem prender o usuario ao valor sugerido",
    ],
  },
  {
    date: "2026-03-17",
    version: "2.9.18",
    type: "release",
    title: "Vertex via ADC e Express Mode isolado para diagnostico",
    items: [
      "IA: vertex_gemini deixou de depender de GEMINI_VERTEX_API_KEY no fluxo principal e passou a inicializar com autenticacao Google de servidor via ADC ou arquivo de service account",
      "IA: strategy, /api/ai-diagnostics e /api/chat-health agora diferenciam project configurado de credencial realmente presente, evitando falso positivo de Vertex disponivel",
      "Operacao: novo helper app/lib/vertex-auth.server.ts centraliza a leitura de GOOGLE_PROJECT_ID, GOOGLE_APPLICATION_CREDENTIALS e do arquivo local application_default_credentials.json",
      "Operacao: npm run ops:test-vertex-express foi criado com o SDK oficial @google/genai para validar Express Mode com API key sem mexer na chain principal do SaaS",
      "Diagnostico real: o ambiente local segue sem ADC carregado e a chave atual de API nao esta sendo aceita como chave de Vertex AI Express Mode",
    ],
  },
  {
    date: "2026-03-16",
    version: "2.9.17",
    type: "release",
    title: "Edicao completa em promocoes e prioridade para distribuicao por NCM",
    items: [
      "Calculadora: a distribuicao por NCM foi movida para o topo da coluna de entrada, virando o primeiro bloco de preenchimento em /calculator",
      "Promocoes e Insta: os cards agora oferecem edicao completa do cadastro, reutilizando o formulario principal com dados ja preenchidos",
      "Loterias: as apostas passaram a ter edicao completa de tipo, nome, data, numeros, status, resultado, premio e observacoes",
      "Operacao: a resposta sobre Vertex ficou apoiada no teste real do provider, que segue falhando por autenticacao do SDK e nao por prompt ou quota",
    ],
  },
  {
    date: "2026-03-16",
    version: "2.9.16",
    type: "release",
    title: "Insta separado nas promocoes e teste reproduzivel do Vertex",
    items: [
      "Promocoes: a aba Insta foi empurrada para o fim da navegacao e passou a usar KPI proprio, sem inflar os numeros da aba principal",
      "Promocoes/Insta: formulario ficou focado em link do post, premio, prazo final, status e comprovante, removendo PDF, tipo, data inicial e numeros da sorte",
      "Promocoes/Insta: cards do Instagram passaram a exibir so o que faz sentido para esse fluxo, como prazo final e link do post oficial",
      "Operacao: novo comando npm run ops:test-vertex valida o Vertex forzado e a chain real usando o .env.codex local, mostrando claramente quando ha fallback para OpenRouter Free",
      "Planejamento: os itens de endurecimento de repositorio e rotacao de segredos foram movidos para docs/IDEAS.md como backlog futuro",
    ],
  },
  {
    date: "2026-03-16",
    version: "2.9.15",
    type: "release",
    title: "Fallback livre do OpenClaw alinhado com a OpenRouter atual",
    items: [
      "OpenClaw: o gateway deixou de usar o slug quebrado do Qwen Free e passou a apontar para openrouter/free como fallback gratuito estavel",
      "SaaS: o primeiro fallback livre da chain tambem passou a usar openrouter/free, reduzindo falhas causadas por slugs free que perderam endpoints na OpenRouter",
      "Telegram: badges e mensagem de erro ficaram coerentes com o provider real, sem marcar como Vertex um retorno de free indisponivel",
      "UI: a aba Conhecimento IA e o dashboard de uso agora mostram OpenRouter Free no lugar do rotulo antigo de Qwen Free",
    ],
  },
  {
    date: "2026-03-15",
    version: "2.9.14",
    type: "release",
    title: "Hardening de webhooks, diagnostico e escopo por empresa",
    items: [
      "Telegram: os webhooks do SaaS e do OpenClaw passaram a validar o header secreto do Telegram, e o setup do webhook agora exige chave administrativa",
      "CRM e Processos: detalhes, edicoes, contatos e download de documentos agora confirmam companyId antes de ler, atualizar ou apagar dados",
      "Diagnostico: /api/ai-diagnostics e /api/chat-health ficaram restritos a sessao do Luiz, e /api/health + /api/monitor-openclaw deixaram de expor detalhes internos da infraestrutura",
      "Seguranca operacional: novo helper centraliza a derivacao e a validacao dos secrets de webhook sem depender de segredos hardcoded",
    ],
  },
  {
    date: "2026-03-15",
    version: "2.9.13",
    type: "release",
    title: "Instagram nas promocoes, radio monitor ampliado e chat estabilizado",
    items: [
      "Promocoes: nova aba Insta passou a registrar links oficiais de posts do Instagram e separar esse fluxo da lista manual",
      "Promocoes: botao Ler link com IA agora aproveita metadados HTML para preencher melhor regras, datas e contexto de links publicos",
      "Radio Monitor: radios agora aceitam tambem a URL do perfil no Instagram, com exibicao direta nos cards e no formulario de edicao",
      "Chat interno: OpenClaw passou a ser aceito no payload do /api/chat, com fallback nominal correto e regressao coberta no E2E",
      "CSRF local: o cookie de formulario deixou de usar o prefixo __Host- em ambiente de desenvolvimento HTTP, destravando login e suites Playwright locais",
    ],
  },
  {
    date: "2026-03-15",
    version: "2.9.12",
    type: "release",
    title: "Vida Pessoal prioriza Promocoes e Sorteios",
    items: [
      "A landing de Vida Pessoal agora abre com a secao Promocoes e Sorteios no topo",
      "A rota /personal-life foi saneada para manter os mesmos modulos com textos e ordem mais limpos",
    ],
  },
  {
    date: "2026-03-15",
    version: "2.9.11",
    type: "release",
    title: "Skills visuais, financeiro integrado e literario com IA",
    items: [
      "Agentes: aba Conhecimento IA passou a ler openclaw.json e os prompts reais para mostrar skills ativas, hierarquia de modelos e alinhamento por agente",
      "Financeiro: Assinaturas deixou o menu lateral principal e agora aparece como aba interna do fluxo financeiro",
      "Promocoes/Literario: concursos cadastrados ganharam edicao direta pela lista",
      "Promocoes/Literario: novo Ler link com IA busca a pagina do concurso, extrai os pontos relevantes e preenche o formulario automaticamente",
    ],
  },
  {
    date: "2026-03-15",
    version: "2.9.10",
    type: "release",
    title: "OpenClaw atualizado para 2026.3.13",
    items: [
      "OpenClaw Gateway: Dockerfile passou a instalar openclaw@2026.3.13 no lugar da 2026.3.2",
      "OpenClaw: mensagem de deploy enviada ao Telegram agora anuncia Gateway v2026.3.13",
      "API: system_status do SaaS passou a exibir 2026.3.13 como fallback da versao do OpenClaw",
      "Validacao operacional previa confirmou a instalacao de openclaw@2026.3.13 sobre node:22-slim com git e ca-certificates",
    ],
  },
  {
    date: "2026-03-14",
    version: "2.9.9",
    type: "release",
    title: "Smoke de producao tolera aquecimento do OpenClaw",
    items: [
      "CI: scripts/smoke-production.mjs passou a repetir o check do OpenClaw com backoff simples antes de declarar falha",
      "Smoke: o job continua falhando se o gateway permanecer offline, mas deixa de quebrar por boot legitimo logo apos o deploy",
    ],
  },
  {
    date: "2026-03-14",
    version: "2.9.8",
    type: "release",
    title: "CSRF reforcado, planejamento saneado e smoke pos-deploy concluido",
    items: [
      "Seguranca: formularios de login, logout, settings, CRM, processos e subscriptions passaram a validar CSRF e same-origin em todas as mutacoes POST",
      "Sessao: producao passa a emitir __Host-session, mantendo leitura do cookie legado para evitar logout forcado no rollout",
      "Documentacao: docs/ROADMAP.md, docs/AUTOMATIONS-ROADMAP.md e docs/IDEAS.md foram saneados para refletir o estado real do SaaS e do OpenClaw",
      "CI: workflow ganhou o smoke-production para validar /login, /api/health e /api/monitor-openclaw apos os deploys",
      "OpenClaw: gateway, Dockerfile e runbook foram alinhados para a porta 3000, eliminando o 502 causado pelo descompasso com o proxy do Coolify",
    ],
  },
  {
    date: "2026-03-14",
    version: "2.9.7",
    type: "release",
    title: "Smoke test de producao validado e entrypoint do OpenClaw endurecido",
    items: [
      "Producao: login, dashboard, /squad, /subscriptions, /personal-life/radio-monitor e /settings responderam corretamente em smoke test autenticado",
      "OpenClaw: entrypoint agora define NODE_COMPILE_CACHE por padrao e OPENCLAW_NO_RESPAWN=1 para reduzir warnings operacionais e evitar respawn desnecessario no container",
      "Documentacao permanente: CLAUDE.md foi alinhado com a chain real do SAAS baseada em Vertex Gemini, Qwen, Llama e DeepSeek",
    ],
  },
  {
    date: "2026-03-14",
    version: "2.9.6",
    type: "release",
    title: "Roadmap e OpenClaw alinhados ao estado real do projeto",
    items: [
      "Documentacao: docs/ROADMAP.md foi reescrito para refletir os modulos realmente publicados e remover referencias obsoletas como openrouter_paid e multi-tenancy amplo",
      "Seguranca operacional: o roadmap deixou de carregar token de bot e exemplo de Bearer real dentro do repositorio",
      "OpenClaw: openclaw.json agora inclui safeBinProfiles scaffold para curl, jq, date, echo e openclaw, alem de /usr/local/bin em safeBinTrustedDirs",
      "CRM Pipeline: import morto de useRevalidator foi removido, limpando o warning simples de build nessa rota",
    ],
  },
  {
    date: "2026-03-14",
    version: "2.9.5",
    type: "release",
    title: "OpenClaw virou operador do CRM e de processos",
    items: [
      "OpenClaw Tools: criar_cliente passou a aceitar apenas CNPJ, com enriquecimento automatico de dados cadastrais quando possivel",
      "OpenClaw Tools: abrir_processo passou a aceitar cliente + modal e assumir import quando o tipo nao vier explicito",
      "OpenClaw Tools: nova action atualizar_processo permite alterar processo por referencia com status, observacoes e campos operacionais",
      "Telegram OpenClaw: handlers de cliente e processo agora usam o mesmo nucleo operacional do endpoint /api/openclaw-tools",
      "OpenClaw prompts: SOUL.md e skill SAAS passaram a instruir o uso direto desses atalhos operacionais",
    ],
  },
  {
    date: "2026-03-14",
    version: "2.9.4",
    type: "release",
    title: "Curadoria da raiz e reorganizacao da documentacao",
    items: [
      "Documentacao: arquivos historicos foram movidos para docs/history e ROADMAP, IDEAS e AUTOMATIONS-ROADMAP foram centralizados em docs/",
      "OpenClaw: MEMORY.md e TRAINING.md foram movidos para openclaw-gateway/prompts, alinhando a documentacao ao gateway",
      "Outros Negocios: pagina Criar/Publicar Apps passou a ler e salvar em docs/IDEAS.md",
      "App: rotas mortas ui-concept-a, ui-concept-b e ui-concept-c foram removidas do registro do React Router",
      "Infra: .gitignore ganhou um bloco final para logs, coverage, relatarios Playwright, .react-router e arquivos residuais do Windows",
    ],
  },
  {
    date: "2026-03-14",
    version: "2.9.3",
    type: "release",
    title: "Monitor de deploy do Coolify corrigido",
    items: [
      "CI: leitura do retorno da API do Coolify agora usa stdin em vez de sys.argv, eliminando o erro 'argument list too long'",
      "CI: monitor de deploy do SaaS passou para 45 tentativas e o do OpenClaw para 90 tentativas",
      "OpenClaw: deploy real da imagem d98e545 foi confirmado em producao; a falha anterior era apenas do monitoramento do job",
    ],
  },
  {
    date: "2026-03-14",
    version: "2.9.2",
    type: "release",
    title: "Migration 0009 aplicada e OpenClaw pronto para publicar",
    items: [
      "Producao: migration 0009_amusing_celestials foi aplicada com sucesso no banco do SaaS",
      "Assinaturas: tabela subscriptions e indices agora existem em producao",
      "Radio Monitor: colunas website_url, contact_phone e contact_whatsapp foram criadas em radio_stations",
      "AI Usage: coluna provider migrou do enum ai_provider para varchar(64) sem dependencias residuais",
      "OpenClaw: changelog interno foi atualizado para descrever os 8 agentes, a nova chain de IA e o cron de update check",
      "CI: workflow passou a usar FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true e actions/upload-artifact@v7",
    ],
  },
  {
    date: "2026-03-14",
    version: "2.9.1",
    type: "release",
    title: "Auto-deploy do OpenClaw e pipeline segmentada",
    items: [
      "CI/CD: workflow agora publica o SaaS e o OpenClaw em jobs separados no GitHub Actions",
      "OpenClaw: deploy automatico via Coolify so dispara quando houver alteracoes em openclaw-gateway/",
      "CI: upload do relatorio Playwright migrado para actions/upload-artifact@v5, eliminando o aviso legado de Node 20 nessa etapa",
      "Infra: secret COOLIFY_OPENCLAW_APP_UUID registrado no GitHub para permitir deploy automatico do container separado",
    ],
  },
  {
    date: "2026-03-14",
    version: "2.9.0",
    type: "release",
    title: "Squad Room, subscriptions e OpenClaw multiagente",
    items: [
      "IA: cadeia do SAAS passou para Vertex Gemini -> Qwen Free -> Llama Free -> DeepSeek R1 Free -> DeepSeek Direct",
      "OpenClaw: openclaw.json agora registra 8 agentes especialistas com workspaces dedicados e cron de update check toda segunda 9h BRT",
      "OpenClaw: SOUL.md e AGENTS.md foram reescritos com autonomia controlada, leitura financeira segura e delegacao objetiva",
      "OpenClaw: novas skills locais lhfex-comex-expert, lhfex-licitacoes e lhfex-promocoes criadas do zero",
      "UI: nova rota protegida /squad em estilo Pixel Room e link no menu desktop/mobile",
      "Assinaturas: nova tabela subscriptions, rota /subscriptions com CRUD, totais BRL/USD e endpoint ver_assinaturas para o OpenClaw",
      "Radio Monitor: radios agora suportam website_url, contact_phone e contact_whatsapp com links clicaveis e modal de edicao",
      "Migrations: 0009_amusing_celestials inclui subscriptions, novos campos de radio e ajuste definitivo do provider de ai_usage_logs",
    ],
  },
  {
    date: "2026-03-13",
    version: "2.8.7",
    type: "release",
    title: "Correcao estrutural do countTokens no Gemini",
    items: [
      "Gemini Free: request de countTokens passou a enviar model dentro de generateContentRequest, como exigido pela API",
      "Smoke test operacional confirmou Groq Whisper autenticando com sucesso",
      "Smoke test operacional confirmou que a chave Gemini esta valida, mas a conta atual esta retornando 429 por limite de quota",
    ],
  },
  {
    date: "2026-03-13",
    version: "2.8.6",
    type: "release",
    title: "Gemini Free otimizado e workflow de coverage alinhado",
    items: [
      "Gemini Free: prompts passaram a separar system, context e task com delimitadores XML no provider Gemini",
      "Gemini Free: countTokens agora roda antes do generateContent, com resumo preventivo quando o contexto cresce demais",
      "Gemini Free: Flash-Lite ficou restrito a chat e telegram simples; NCM, OCR e contextos maiores permanecem no Flash 2.0",
      "CI: workflow migrou checkout, setup-node e Codecov para v5",
      "CI: job de unit tests passou a gerar coverage-final.json e so tenta upload no Codecov quando CODECOV_TOKEN existir",
    ],
  },
  {
    date: "2026-03-13",
    version: "2.8.5",
    type: "release",
    title: "Autenticacao, chat e NCM estabilizados para a suite E2E",
    items: [
      "Chat: widget recebeu atributos de acessibilidade e os testes passaram a usar seletores do DOM real",
      "CRM: campos do cadastro de cliente agora associam label e input corretamente",
      "Autenticacao: lockout passou a registrar apenas falhas reais de login, evitando bloqueio indevido de usuarios e E2E",
      "NCM: classificacao deixou de depender de DeepSeek obrigatorio, voltou ao fluxo free-first e ganhou timeout controlado",
      "Auditoria: login_failed deixa user_id nulo quando nao existe usuario em vez de gravar string invalida em coluna UUID",
    ],
  },
  {
    date: "2026-03-13",
    version: "2.8.4",
    type: "release",
    title: "E2E com seletores estaveis e webServer local corrigido",
    items: [
      "Playwright: fluxo de login dos testes passou a usar os campos reais do formulario em vez de labels traduzidos",
      "Playwright local: webServer agora sobe o react-router dev na porta 3000, a mesma esperada pela suite",
    ],
  },
  {
    date: "2026-03-13",
    version: "2.8.3",
    type: "release",
    title: "Ajuste dos testes E2E para o login atual",
    items: [
      "Playwright: senha dos testes atualizada para combinar com o seed executado na pipeline",
      "Playwright: validacao da pagina de login passou a usar os elementos reais da UI atual",
    ],
  },
  {
    date: "2026-03-13",
    version: "2.8.2",
    type: "release",
    title: "Correcao do boot E2E no CI",
    items: [
      "Playwright em CI agora sobe o servidor com npm run start apos o build pronto",
      "reuseExistingServer ficou restrito ao ambiente local para evitar timeout no webServer do GitHub Actions",
    ],
  },
  {
    date: "2026-03-13",
    version: "2.8.1",
    type: "release",
    title: "Estabilidade de CI e integracoes auxiliares",
    items: [
      "CI: typecheck voltou a passar com ajustes em seeds, scripts e rotas auxiliares",
      "OpenClaw: companyId aplicado nas acoes e consultas de clientes e processos",
      "Financeiro e notificacoes: correcao de UUIDs, contatos primarios e importacao de cashflow",
      "Documentacao: instrucoes permanentes consolidadas em CLAUDE.md sem expor segredos operacionais",
    ],
  },
  {
    date: "2026-03-12",
    version: "2.8.0",
    type: "release",
    title: "Formato A26-001 com sequencia por modal",
    items: [
      "Processos: referencia passou a usar o padrao A26-001, M26-001 e C26-001 conforme o modal",
      "Processos: proxima numeracao agora e calculada por prefixo e ano, evitando colisao entre modais",
      "Banco: registros de teste IMP-2026-0001 e A26002 removidos da tabela processes",
      "Infra: .env.codex ignorado pelo Git para proteger credenciais locais",
      "Documentacao: backlog IDEAS.md atualizado com Edge-TTS e notas do SandeClaw",
    ],
  },
  {
    date: "2026-03-11",
    commit: "8268979",
    type: "fix",
    title: "Hardening multi-tenant em finanças e vida pessoal",
    items: [
      "Segurança: filtro obrigatório por companyId em financial-detail (loader e action), bloqueando acesso cruzado entre empresas",
      "Segurança: cashflow server passou a exigir companyId e aplicar isolamento por tenant em consultas de movimentos",
      "Segurança: rota financial-cashflow agora resolve companyId do usuário autenticado antes de carregar dados",
      "Infra: correção de sintaxe em routes.ts para manter registro e typegen de rotas estáveis",
      "Deploy: pacote publicado em main para atualização automática do SAAS no Coolify",
    ],
  },
  {
    date: "2026-03-11",
    commit: "8970386",
    type: "feat",
    title: "Fases internas concluídas (F0-F4): finanças pessoais, compras públicas e comex operacional",
    items: [
      "Firefly/Finanças pessoais: bootstrap automático de company_profile, removendo bloqueio por ausência de configuração inicial",
      "Firefly: rotas filhas registradas em /personal-life/finances (accounts, transactions, budgets, recurring)",
      "Firefly: loaders/actions de dashboard, contas, lançamentos, orçamentos, recorrências e analytics padronizados para uso interno sem gate de setup",
      "Compras públicas: /public-procurement/:noticeId agora carrega dados reais do banco (edital, itens e histórico)",
      "Compras públicas: ações de alteração de status, inclusão de item e cancelamento registram trilha em public_procurement_history",
      "Comex/Calculadora: botão para copiar resumo técnico-financeiro da simulação (CIF, tributos e custo total)",
      "Infra/Deploy: pacote publicado em main para disparo automático do Coolify",
    ],
  },
  {
    date: "2026-03-11",
    type: "fix",
    title: "Estabilidade de build: Descrição/NCM e detalhe financeiro",
    items: [
      "Fix: descricao-ncm removido import de tipo gerado ausente (+types/descricao-ncm), eliminando erro de compilação",
      "Fix: descricao-ncm tipagem explícita no map do histórico para remover any implícito",
      "Fix: financial-detail deixou de usar clients.email (campo inexistente) e passou a buscar e-mail via contato primário",
      "Stability: fluxo de envio de fatura por e-mail mantido com fallback quando cliente não possui contato com e-mail",
    ],
  },
  {
    date: "2026-03-10",
    version: "2.7.0",
    type: "release",
    title: "Módulo Descrição/NCM + PTAX Venda + Referência sem traços + Migrations pendentes",
    items: [
      "COMEX: novo módulo Descrição/NCM — IA gera descrição robusta (DI/DUIMP) + sugere NCM com justificativa",
      "COMEX: módulo Descrição/NCM com workflow de aprovação/revisão e histórico completo",
      "Câmbio: dólar agora usa PTAX Venda do BCB (taxa oficial de importação) em vez de média compra/venda",
      "Câmbio: PTAX Venda é a taxa primária no Dashboard; AwesomeAPI é fallback",
      "Processos: referência sem traços — formato A26001, M26002, C26003 (aéreo/marítimo/outro)",
      "Processos: label 'Modal para Referência' renomeado para 'Referência'",
      "Processos: mensagem de erro ao salvar agora exibe causa real do banco",
      "Promoções/Loterias: mensagem de erro humanizada (sem exibir SQL bruto)",
      "Infra: migrations 0004-0007 aplicadas (lucky numbers, loterias, custos por processo, descrição/NCM)",
      "Fix: /automations — API de logs agora com try/catch (evita 500 do fetcher) + ErrorBoundary dedicado na rota",
    ],
  },
  {
    date: "2026-03-09",
    version: "2.6.4",
    type: "release",
    title: "Pacote único de correções críticas: Automações, Processos, Promoções/Loterias e CRM",
    items: [
      "Fix: /automations com loader resiliente (falhas parciais não derrubam mais a página)",
      "Fix: /processes/new com normalização de campos numéricos e tratamento explícito de erro de persistência",
      "Fix: Promoções/Loterias com feedback de erro em tela e fechamento de formulário apenas após sucesso",
      "CRM: adicionada edição de contatos após cadastro (rota dedicada de edição)",
      "Calculadora COMEX: novo bloco de distribuição Multi-NCM com alíquotas por NCM (II, IPI, PIS e COFINS)",
      "OpenClaw: removido fallback com modelo inválido que gerava erro 400 de model ID",
      "Câmbio: endpoint /api/exchange-rate validado com taxa do dia em 4 casas decimais",
    ],
  },
  {
    date: "2026-03-07",
    version: "2.6.3",
    type: "release",
    title: "Estabilidade 500 + Vida Pessoal reorganizada + ajuste de dólar/IA",
    items: [
      "Fix: hardening extra para reduzir 500 em /automations, /settings e /processes/cost-report",
      "Vida Pessoal: remoção dos cards fake do topo e remoção do bloco de Automação Pessoal",
      "Vida Pessoal: reorganização dos módulos por grupos e nova rota /personal-life/health",
      "Saúde: foco ampliado para controle de peso e medidas corporais (tipos/unidades)",
      "Dashboard: cotação do dólar agora usa /api/exchange-rate com exibição da fonte",
      "Câmbio: AwesomeAPI priorizada e PTAX mantida como fallback/referência",
      "IA Usage: DeepSeek permanece visível no painel mesmo com baixo volume",
      "Menu lateral: removida duplicidade de 'Conhecimento IA' fora de IA Agentes",
    ],
  },
  {
    date: "2026-03-07",
    version: "2.6.2",
    type: "release",
    title: "Modelo de custos por processo + relatorio dedicado",
    items: [
      "Processos: criacao/edicao com controle de custos por processo (estimado, real e observacoes)",
      "Processos: fluxo de criacao simplificado sem aprovacao manual obrigatoria",
      "Processos: nova tela /processes/cost-report com consolidado e variacao por processo",
      "Processos: card de custos exibido no detalhe de cada processo",
      "Infra: migration 0006_process_costs.sql adicionada para campos de custo na tabela processes",
      "Fix: parser de checkbox costControlEnabled normalizado no validator para evitar falhas de submissao",
    ],
  },
  {
    date: "2026-03-07",
    version: "2.6.1",
    type: "release",
    title: "Estabilidade 500 + IA/AUTOMAÇÕES reestruturado + Loterias + Ex-Tarifarios",
    items: [
      "Fix: hardening de erro em /personal-life/promotions, /automations e /api/promotions para reduzir 500 em produção",
      "IA/AUTOMAÇÕES: Mission Control e Crons movidos para /automations; /agents mantido com Agentes + Conhecimento",
      "Settings: changelog incorporado acima dos logs de auditoria; prompt guide removido da settings para evitar duplicidade",
      "Promoções: nova aba Loterias com fluxo manual de cadastro, conferência, ganho e encerramento sem ganho",
      "Comex: nova página /ex-tarifarios com leitura da fonte oficial do MDIC",
      "Outros: nova página /other-business/apps para salvar ideias diretamente no IDEAS.md",
      "Settings/APIs: links de monitoramento adicionados para Groq e AwesomeAPI",
    ],
  },
  {
    date: "2026-03-07",
    version: "2.6.0",
    commit: "b4261b7",
    type: "release",
    title: "Promoções + Bots + Google Calendar + Alertas Unificados + Rotinas de Saúde",
    items: [
      "Promoções: correção da extração de PDF com compatibilidade pdf-parse v2 (api.promotion-extract e api.ocr-extract)",
      "Promoções: edição pós-criação na aba Sites implementada",
      "Promoções: números da sorte adicionados (informado, oficial e inferido) com comparação por distância",
      "Promoções: importação SCPC corrigida para evitar falso 'Já cadastrada' antes da resposta da API",
      "Promoções: reorganização de abas (Rádio integrado e aba Concurso renomeada para Literário)",
      "Vida Pessoal: card duplicado de Pessoas removido da home",
      "Fix de build: JSX da tela de Promoções corrigido (bloco SCPC/Nome), liberando deploy SAAS",
      "Telegram SAAS/OpenClaw: cadastro de cliente com CNPJ agora exige confirmação explícita (sim/não, expira em 10 min)",
      "Google: integração inicial com Calendar via API /api/google-calendar-event, com suporte a texto natural",
      "Google OAuth: escopo calendar.events adicionado no fluxo existente",
      "Alertas de prazo: cron deadlines_alert expandido para promoções, objetivos, concursos, estudos (provas/trabalhos) e time off",
      "Alertas: unificação em resumo diário único incluindo também tarefas e vencimentos (evita mensagens duplicadas)",
      "Rotinas: módulo reformulado para foco em saúde (tipos e linguagem de bem-estar, autocuidado e prevenção)",
      "Produção: múltiplos deploys concluídos em sequência com validação de SOURCE_COMMIT nos containers",
    ],
  },
  {
    date: "2026-03-06",
    version: "2.5.1",
    commit: "c55b167",
    type: "fix",
    title: "Estabilização OpenClaw + Cancelamento de Processos + Webhooks Operacionais",
    items: [
      "OpenClaw: queue 114 validada (estado error, sem travamento pendente)",
      "OpenClaw: Dockerfile alinhado para openclaw@2026.3.2 e redeploy monitorado até status finished",
      "OpenClaw: correção de runtime para openclaw.json ausente no container após rotação",
      "OpenClaw: skill SAAS sincronizada em /root/.openclaw/workspace/skills e /root/.openclaw/prompts/skills",
      "SAAS: tela de processos agora abre com filtro padrão 'Em andamento' (todos os status via seleção manual)",
      "SAAS: novo fluxo de cancelamento de processo com justificativa obrigatória, mantendo histórico e numeração contínua",
      "SAAS: cancelamento grava timeline e auditoria (status alterado para cancelled, sem deleção)",
      "Webhook OpenClaw: comando /cancelar_processo + linguagem natural para cancelar com justificativa",
      "Webhook SAAS: comandos operacionais admin (criar cliente, abrir processo, cancelar processo) via Telegram",
      "AI fallback SAAS: OpenRouter Free agora seleciona modelo gratuito disponível dinamicamente (evita queda prematura para DeepSeek Paid quando um modelo free sai do ar)",
      "Bots SAAS/OpenClaw: fallback pago agora exige liberação explícita no Telegram (/pago ou /deepseek), mantendo free-first por padrão",
      "Agentes SAAS: diretriz de honestidade reforçada (não inventar execução/status; declarar falhas e limites com clareza)",
      "Bots Telegram: mensagens com CNPJ agora acionam fluxo operacional de cadastro de cliente automaticamente",
      "Cadastro de cliente: enriquecimento por CNPJ (razão social/cidade/UF) antes de gravar, quando possível",
      "OpenClaw skill runtime: SAAS.md em workspace com URL/chave resolvidas para evitar erro 'Invalid URL: ${SAAS_URL}'",
      "Deploy SAAS da feature de cancelamento concluído (queue 131 finished)",
      "Webhook SAAS: suporte ampliado para mídia enviada como documento (áudio/image/*), com transcrição/análise e fallback claro quando formato não suportado",
      "Webhook OpenClaw: análise de imagem e transcrição de áudio agora entram no fluxo do agente (resposta contextual, sem análise isolada)",
      "Tela /changelog: entradas agora agrupadas por dia automaticamente para consolidar todas as atualizações da data",
    ],
  },
  {
    date: "2026-03-05",
    version: "2.5.0",
    commit: "020ec0a",
    type: "release",
    title: "OpenClaw v2.0 — Multi-Agentes + SAAS Total Access + LLM Chain Fix",
    items: [
      "OpenClaw: 4 agentes nomeados (AIrton 🎯, IAna 📦, marIA 💰, IAgo 🔧) com system prompts especializados",
      "OpenClaw: thinking adaptativo (thinkingDefault: adaptive) + PDF model Gemini Flash",
      "OpenClaw: browser Playwright habilitado (headless, noSandbox) — Dockerfile atualizado",
      "OpenClaw: web search via Perplexity sonar (OpenRouter) + exec com allowlist",
      "OpenClaw: plugin llm-task habilitado + skill SAAS.md com guia completo de acesso",
      "OpenClaw: Telegram Forum topics placeholder — routear cada tópico a um agente dedicado",
      "SAAS API: 8 novos endpoints GET — cotacao_dolar, ver_investimentos, ver_habitos, ver_objetivos, ver_pessoas, ver_folgas, ver_tarefas_mc, contexto_completo",
      "SAAS API: contexto_completo usa Promise.allSettled com 7 sub-queries paralelas para snapshot único",
      "SAAS API: Jina AI search gratuito (10M tokens/mês) documentado na skill SAAS.md",
      "fix(ai): providerCallMap removeu openrouter_paid (dead code — chamava callOpenRouterFree)",
      "fix(ai): LIFE_AGENT_MAX_OUTPUT_TOKENS aumentado de 1200 → 3000",
      "fix(ai-strategy): simplificado para 3 tiers (Gemini → OpenRouter Free → DeepSeek Paid)",
      "IDEAS.md criado com backlog de ideias futuras organizadas por categoria",
    ],
  },
  {
    date: "2026-03-04",
    version: "2.4.0",
    commit: "df278fe",
    type: "release",
    title: "Áudio/Imagem nos Agentes + Task Queue + Cost Optimization + Fixes",
    items: [
      "fix(openclaw): comentários // no openclaw.json causavam crash do container — JSON inválido removido",
      "fix: tabelas daily333, seinfeld_habits, seinfeld_logs, claude_tasks criadas via db:push",
      "Airton, IAna, marIA e IAgo agora transcrevem áudio (Groq Whisper) e analisam fotos (Gemini Vision)",
      "Task queue OpenClaw↔Claude Code via tabela claude_tasks + scripts/claude-daemon.sh",
      "Guardrails de custo no SOUL.md: max 2 tools/heartbeat, warning 25 msgs, loop detection",
      "Heartbeat 30min (era 15min) — redução de ~50% no custo idle do OpenClaw",
      "API openclaw-tools: buscar_processos slim (10 registros, campos reduzidos)",
      "Protocolo debugging 4 fases — openclaw-gateway/prompts/skills/diagnostico.md",
      "Concursos Literários: 4th tab no módulo Promoções com sites, Sudowrite AI e tabela de inscrições",
      "Módulo Produtividade: Pomodoro, 3-3-3, Eisenhower, Seinfeld streak, Time Blocking",
      "Monitor OpenClaw: cron heartbeat 3x/dia (9h, 15h, 21h) + endpoint GET /api/monitor-openclaw",
      "CHANGELOG.md criado no openclaw-gateway/prompts/ para auto-consciência do OpenClaw",
      "entrypoint.sh: copia skills/ e CHANGELOG.md ao workspace, notificação de deploy no Telegram",
    ],
  },
  {
    date: "2026-03-03",
    version: "2.3.0",
    commit: "646235f",
    type: "release",
    title: "Slate Pro + OpenClaw 2.0 + Faturamento Profissional",
    items: [
      "Redesign 'Slate Pro' — sidebar escura, accent índigo, Inter font, cards flat com ícones Lucide",
      "Logo circle (SVG) como favicon + apple-touch-icon no root.tsx e tela de login",
      "OpenClaw: hierarquia 4 camadas (Gemini 2.0 Flash → OpenRouter auto → DeepSeek → Kimi K2.5)",
      "OpenClaw: SOUL.md com regra de honestidade absoluta (NUNCA MINTA) + controle de acesso por usuário",
      "OpenClaw: 7 cron jobs — update-check (10h), vps-daily (7h), personal-morning (8h), morning-brief (8:30h dias úteis), lhfex-weekly (seg 9h), promotions-checker (seg/qua/sex 12h), process-alerts-pm (18h dias úteis)",
      "Telegram webhook: transcrição de áudio via Groq Whisper (whisper-large-v3-turbo)",
      "Telegram webhook: análise de imagens via Gemini Vision 2.0 Flash",
      "Dia Limpo: streak tracker com grid estilo GitHub contributions — schema, migração e UI completa",
      "Dashboard: cotação PTAX BCB com data de atualização ('DD/MM/YYYY') abaixo do valor",
      "Faturamento: template HTML profissional com logo LHFEX, tabela de itens e dados Banco Inter para impressão/PDF + envio por email",
      "OPENCLAW_TOOLS_API_KEY: configurada em saas-lhfex e openclaw-ai para comunicação segura",
      "fix(openclaw): removido agents.defaults.quietHours (chave inválida) — quiet hours via SOUL.md",
    ],
  },
  {
    date: "2026-03-02",
    type: "fix",
    title: "openclaw: heartbeat model + deepseek fallback + RUNBOOK",
    items: [
      "Heartbeat model: gemini-2.0-flash-lite → gemini-2.0-flash (lite retornava FailoverError: Unknown model)",
      "Fallback deepseek: removido sufixo :free que causava 404 No endpoints found",
      "RUNBOOK.md criado em openclaw-gateway/ com diagnóstico dos 7 bugs e guia de operação",
    ],
  },
  {
    date: "2026-03-02",
    type: "fix",
    title: "TypeScript: 5 erros corrigidos + E2E timeout",
    items: [
      "ai.server.ts: removido .toISOString() em campos SQL DATE (já retornam string YYYY-MM-DD)",
      "ai.server.ts: Blob([new Uint8Array(audioBuffer)]) para compatibilidade TypeScript",
      "api.openclaw-tools.tsx: removido campo createdBy inexistente na tabela contacts",
      "notifications.ts: enum notification_type alinhado com valores usados no código",
      "playwright.config.ts: reuseExistingServer=true, timeout aumentado para 180s",
    ],
  },
  {
    date: "2026-03-02",
    type: "feat",
    title: "Módulo Estudos — /personal-life/studies",
    items: [
      "Schema: 3 tabelas — personal_study_courses, personal_study_subjects, personal_study_events",
      "UI: tabs Cursos, Matérias e Agenda com formulários inline",
      "Agenda: botão 📅 Adicionar ao Google Calendar via deep link (sem OAuth)",
      "API: /api/personal-studies com CRUD completo (GET + POST)",
      "Integrado ao dashboard Vida Pessoal com card 🎓 Estudos",
    ],
  },
  {
    date: "2026-02-26",
    type: "feat",
    title: "OpenClaw AI Gateway",
    items: [
      "Container Docker autônomo em openclaw-gateway/ — build via Coolify a partir do repo público",
      "Modelo primário Gemini 2.0 Flash + roteamento por tarefa (brain, subagent, coding, research)",
      "Slack Socket Mode — openclaw.ai conectado ao workspace LHFEX via xapp token",
      "Heartbeat a cada 15 min — verifica WORKING.md e notifica urgências via Telegram",
      "Backup de memória automático no GitHub (luizlhfex-br/saas-lhfex)",
      "Morning brief às 8h e alertas de processos às 18h nos dias úteis",
      "Sonar (Perplexity) adicionado como modelo 'research' para perguntas com dados em tempo real",
    ],
  },
  {
    date: "2026-02-26",
    type: "feat",
    title: "Mission Control & Crons",
    items: [
      "Kanban com 6 colunas em /agents — inbox, todo, in_progress, review, done, blocked",
      "Tab 'Crons' em /agents — visualização e gerenciamento dos crons do openclaw.ai",
      "Tab 'Conhecimento IA' em /agents — gestão de memória e arquivos do agente",
      "Schema mission_control_tasks criado no Postgres",
      "Schema openclaw_crons criado no Postgres",
      "API /api/openclaw-tools: actions criar_tarefa_mc e atualizar_tarefa_mc",
    ],
  },
  {
    date: "2026-02-25",
    type: "feat",
    title: "Audit Log — Recuperar deleções",
    items: [
      "Botão ↩ Recuperar no Audit Log para deleções com menos de 30 dias",
      "Restauração de clientes: reativa registro soft-deleted na tabela clients",
      "Restauração de processos: reativa registro soft-deleted na tabela processes",
      "API /api/audit-log com action restore_deletion",
    ],
  },
  {
    date: "2026-02-25",
    type: "feat",
    title: "API openclaw-tools",
    items: [
      "Endpoint GET/POST /api/openclaw-tools com autenticação via header X-OpenClaw-Key",
      "14 actions: resumo_processos, buscar_processos, ver_financeiro_pessoal, listar_promocoes, buscar_clientes, system_status, criar_cliente, abrir_processo, adicionar_transacao, ask_agent (IAna/marIA/AIrton), criar_tarefa_mc, atualizar_tarefa_mc",
    ],
  },
  {
    date: "2026-02-24",
    type: "feat",
    title: "Integração SCPC",
    items: [
      "Busca de CPF/CNPJ em tempo real via scraping do portal SCPC",
      "Exibe pendências financeiras e alertas integrados ao CRM de clientes",
      "Dados sempre frescos — sem cache, consulta ao vivo a cada busca",
    ],
  },
  {
    date: "2026-02-23",
    type: "feat",
    title: "Módulo Pessoas + Melhorias gerais",
    items: [
      "Novo módulo 👥 Pessoas em /personal-life/pessoas — cadastro de contatos com Nome, CPF, RG, Nascimento, Celular, E-mail, Instagram, Endereço, Senhas e Observações",
      "Cards expansíveis com toggle de senha e botões de cópia (CPF, celular, senha)",
      "Busca por nome com filtro GET",
      "Tabela 'pessoas' criada no Postgres com soft-delete",
      "Fix: Firefly removido das abas do módulo financeiro LHFEX (era link para /personal-life/finances)",
      "Fix: VPS Monitor — substituído os.loadavg() por leitura real de /proc/stat (dual-snapshot 500ms) — elimina alertas falsos de 100% CPU",
      "Radio Monitor VM: APIs /api/radio-monitor-config e /api/radio-monitor-event criadas para integração com script VOSK na VPS",
      "Changelog criado em /changelog",
    ],
  },
  {
    date: "2026-02-22",
    type: "feat",
    commit: "cafe620",
    title: "PDF auto-fill em Promoções + Radio Monitor ativado",
    items: [
      "Promoções: botão 'Extrair com IA' — upload de PDF de regulamento, openclaw extrai nome/empresa/prêmio/datas/regras e preenche o formulário automaticamente",
      "Rota POST /api/promotion-extract com pdf-parse + openclaw (hub multi-provedor)",
      "Radio Monitor: captura de stream HTTP (~30s) + transcrição Groq Whisper (whisper-large-v3-turbo gratuito)",
      "Detecção de palavras-chave na transcrição + notificação Telegram via openclaw bot",
      "Cron 'radio_monitor' adicionado (a cada 2h)",
      "radio-monitor.server.ts criado com captureStreamSegment() e runRadioMonitor()",
      "transcribeRadioSegment() e detectPromotionKeywords() em ai.server.ts",
      "Fix: parsePromotionText usa openclaw com userId real (não 'system') para evitar erro UUID no Postgres",
      "Fix: provider padrão hub multi-provedor (Gemini FREE → OpenRouter FREE → DeepSeek) sem forceProvider",
    ],
  },
  {
    date: "2026-02-21",
    type: "feat",
    commit: "56560ff",
    title: "Promoções pessoais + Visão Geral de Automações",
    items: [
      "Módulo 🎁 Promoções em /personal-life/promotions com CRUD completo",
      "Tabela 'promotions' no schema personal-life.ts (soft-delete, participationStatus)",
      "Visão Geral de Automações em /automations/overview — catálogo de todos os crons e webhooks",
      "Agente openclaw como responsável por tudo na aba Vida Pessoal",
    ],
  },
  {
    date: "2026-02-20",
    type: "feat",
    commit: "a4b358e",
    title: "Módulo Vencimentos + alertas VPS semanais",
    items: [
      "Módulo 📋 Vencimentos em /personal-life/bills — gestão de assinaturas, boletos, aluguel",
      "Alertas via Telegram: diário (pendentes do dia) e semanal (resumo da semana)",
      "Schema bills.ts com billPayments, isRecurring, alertDaysBefore, alertOneDayBefore",
      "Cron 'bill_alerts' (diário 8h) e 'vps_weekly_report' (seg 9h)",
      "Fix: cron scheduler — boot imediato e parseInterval corrigido",
    ],
  },
  {
    date: "2026-02-19",
    type: "feat",
    commit: "5fbffd7",
    title: "Multi-bot Telegram + VPS Monitor",
    items: [
      "Separação de bots: MONITOR_BOT_TOKEN (VPS), OPENCLAW_TELEGRAM_TOKEN (vida pessoal), NEWS_BOT_TOKEN (notícias)",
      "Monitor VPS: alerta de CPU, RAM e disco acima dos limites configuráveis",
      "Automações de notícias com NewsAPI + resumo IA",
      "Badge de provider (Gemini/OpenRouter/DeepSeek) nas respostas do chat",
    ],
  },
  {
    date: "2026-02-18",
    type: "feat",
    commit: "239aed8",
    title: "Provider strategy inteligente + budget control",
    items: [
      "Hub multi-provedor: tenta Gemini FREE → OpenRouter FREE → DeepSeek (último recurso)",
      "Budget control: limite diário por provedor configurável via env",
      "forceProvider: opção para forçar DeepSeek em casos que exigem mais capacidade",
      "ai-usage.tsx: dashboard de uso de tokens por provedor e feature",
    ],
  },
  {
    date: "2026-02-15",
    type: "release",
    version: "v2.2.1",
    commit: "afaa75e",
    title: "Fixes críticos e notificações melhoradas",
    items: [
      "Fix: radio monitor schema e rotas corrigidos",
      "Fix: Firefly accounting pages com CRUD completo",
      "OpenClaw bot Telegram integrado — webhook e comandos básicos",
      "Radio Monitor UI com gerenciamento de estações e keywords",
    ],
  },
  {
    date: "2026-02-10",
    type: "release",
    version: "v2.2.0",
    commit: "46e5a98",
    title: "OpenCLAW + Radio Monitor + Firefly",
    items: [
      "Schema: radioStations, radioMonitorEvents, radioMonitorKeywords, fireflyAccounts, fireflyTransactions",
      "Módulo Firefly (finanças pessoais): contas, lançamentos, orçamentos, recorrências",
      "Módulo Radio Monitor: CRUD de estações e palavras-chave",
      "OpenClaw: agente de vida pessoal, webhook Telegram, getPersonalLifeContext()",
      "Company Profile: multi-contas bancárias, enriquecimento CNPJ automático",
    ],
  },
];

const TYPE_CONFIG: Record<ChangeType, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  feat: { label: "Feature", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300", icon: Star },
  fix: { label: "Fix", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300", icon: Bug },
  refactor: { label: "Refactor", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300", icon: Wrench },
  docs: { label: "Docs", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", icon: GitCommit },
  release: { label: "Release", color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300", icon: Zap },
};

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return new Date(`${y}-${m}-${d}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function ChangelogPage() {
  const groupedByDate = CHANGELOG.reduce<Record<string, Entry[]>>((acc, entry) => {
    if (!acc[entry.date]) acc[entry.date] = [];
    acc[entry.date].push(entry);
    return acc;
  }, {});

  const groupedEntries = Object.entries(groupedByDate)
    .sort(([a], [b]) => (a > b ? -1 : 1));

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            📋 Changelog
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Histórico de atualizações do LHFEX SaaS
          </p>
        </div>
      </div>

      {/* Entries grouped by day */}
      <div className="space-y-10">
        {groupedEntries.map(([date, entries]) => (
          <section key={date} className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 pb-2 dark:border-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{formatDate(date)}</h2>
              <span className="text-xs text-gray-500 dark:text-gray-400">{entries.length} atualização(ões)</span>
            </div>

            <div className="relative">
              <div className="absolute left-[18px] top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />

              <div className="space-y-6">
                {entries.map((entry, idx) => {
                  const cfg = TYPE_CONFIG[entry.type];
                  const Icon = cfg.icon;
                  return (
                    <div key={`${date}-${idx}`} className="relative pl-12">
                      <div className="absolute left-0 top-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-white shadow-sm ring-1 ring-gray-200 dark:border-gray-900 dark:bg-gray-900 dark:ring-gray-700">
                        <Icon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                      </div>

                      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.color}`}>
                            {entry.version ?? cfg.label}
                          </span>
                          {entry.commit && (
                            <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
                              #{entry.commit}
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                          {entry.title}
                        </h3>

                        <ul className="mt-3 space-y-1.5">
                          {entry.items.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                              <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gray-400 dark:bg-gray-600" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
