# CLAUDE.md - Instrucoes permanentes do projeto

## Changelog

Sempre que implementar uma feature, bugfix ou refactor, adicionar entrada em
`app/routes/changelog.tsx` antes de commitar.

Formato:

```ts
{
  date: "YYYY-MM-DD",
  type: "feat" | "fix" | "refactor" | "docs" | "release",
  title: "Titulo curto e descritivo",
  items: [
    "Detalhe 1",
    "Detalhe 2",
  ],
}
```

A entrada mais recente vai no topo do array `CHANGELOG`.

## Stack

- Framework: React Router v7 (framework mode, SSR)
- DB: Drizzle ORM + PostgreSQL
- UI: Tailwind CSS + shadcn/ui
- Auth: sessao com `requireAuth(request)`
- Deploy: Coolify na VPS `72.60.151.145`

## Convencoes

- Rotas em `app/routes/` usam padrao `modulo.submodulo.tsx`
- APIs em `app/routes/api.nome.tsx` usam `loader` para GET e `action` para POST
- Schemas Drizzle ficam em `drizzle/schema/*.ts` e devem ser reexportados em `drizzle/schema/index.ts`
- Soft-delete usa `deletedAt` quando o modulo ja segue esse padrao
- Nao commitar segredos. Usar `.env.codex` localmente e secrets do GitHub/Coolify em producao

## Regras criticas

- Toda query de negocio deve considerar `companyId`
- Todo insert de dado de negocio deve persistir `companyId`
- O helper padrao para isso e `app/lib/company-context.server.ts`
- Antes de commitar, rodar `npx tsc --noEmit`
- Em release, atualizar `app/config/version.ts`, `app/routes/changelog.tsx` e `UPDATE-LOG.json`

## Multi-tenant

- O projeto continua single-tenant por design operacional, mas com isolamento por `companyId`
- Nao confiar em `id` sozinho para `select`, `update` ou `delete` de CRM, processos, financeiro e automacoes
- Seeds e scripts tambem precisam criar ou buscar empresa primaria antes de inserir dados de negocio
- Evitar qualquer sugestao de multi-tenancy amplo no roadmap atual

## Referencia de processos

- O formato oficial e `A26-001`, `M26-001` e `C26-001`
- Prefixos:
  - `A` para aereo
  - `M` para maritimo
  - `C` para outros
- A sequencia e independente por modal
- Integracoes como OpenClaw e Telegram devem seguir esse mesmo padrao

## Deploy e CI

- O auto-deploy de producao depende da pipeline GitHub Actions
- O deploy do Coolify deve usar apenas secrets do repositiorio:
  - `COOLIFY_API_TOKEN`
  - `COOLIFY_BASE_URL`
  - `COOLIFY_APP_UUID`
- Nao salvar tokens, chaves ou exemplos reais de `curl` com segredo em arquivos do repo
- Se a pipeline falhar em typecheck ou seed, o deploy nao deve ser considerado valido

## Rotas e registro

- Arquivo existir em `app/routes/` nao garante que a rota esteja acessivel
- Antes de assumir uma URL funcional, conferir registro em `app/routes.ts`
- Isso vale especialmente para rotas utilitarias, impressao, callbacks e APIs temporarias

## IA

- Timezone padrao no contexto de IA: `America/Sao_Paulo`
- Nao usar `openrouter_paid`
- Chain atual do SAAS: Vertex Gemini -> Qwen Free -> Llama Free -> DeepSeek R1 Free -> DeepSeek Direct
- Mudancas em IA devem preservar esse comportamento

## Seguranca operacional

- Se um prompt temporario ou chat antigo tiver exposto segredo, nao copiar para a base permanente
- Documentar apenas processo, decisoes e alertas tecnicos reutilizaveis
- Qualquer credencial exposta deve ser tratada como comprometida e rotacionada fora do repo
