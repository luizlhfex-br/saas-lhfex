/**
 * Application Version Configuration
 * Update this file whenever releasing a new version
 */

export const APP_VERSION = "2.9.5";
export const APP_RELEASE_DATE = "2026-03-14";
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
