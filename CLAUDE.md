# CLAUDE.md — Instruções Permanentes para o Claude Code

## Changelog

Sempre que implementar uma feature, bugfix ou refactor, adicionar entrada em
`app/routes/changelog.tsx` **antes** de commitar.

Formato:
```ts
{
  date: "YYYY-MM-DD",
  type: "feat" | "fix" | "refactor" | "docs" | "release",
  title: "Título curto e descritivo",
  items: [
    "Detalhe 1",
    "Detalhe 2",
  ],
}
```

A entrada mais recente vai no **topo** do array `CHANGELOG`.

## Stack

- Framework: React Router v7 (Remix-based, file-based routing)
- DB: Drizzle ORM + PostgreSQL
- UI: Tailwind CSS + shadcn/ui components
- Auth: cookie-based sessions via `requireAuth(request)`
- Deploy: Coolify (self-hosted) → VPS em 72.60.151.145

## Convenções

- Rotas em `app/routes/` — nomenclatura: `modulo.submodulo.tsx`
- APIs em `app/routes/api.nome.tsx` — `loader` para GET, `action` para POST
- Schemas Drizzle em `drizzle/schema/nome.ts` — exportar em `drizzle/schema/index.ts`
- Após criar/alterar schema: rodar `npm run db:push` para sincronizar com o banco
- Soft-delete: usar campo `deletedAt` em vez de deletar registros
