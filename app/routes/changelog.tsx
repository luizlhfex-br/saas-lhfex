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
