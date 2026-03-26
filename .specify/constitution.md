# Constituicao LHFEX

## 1. Integridade de dados

- Toda query de negocio deve respeitar `companyId`.
- Dados pessoais usam `userId` e nao podem vazar para o escopo empresarial.
- Soft delete continua sendo o padrao quando o dominio ja suporta exclusao logica.

## 2. Gate tecnico minimo

- `npx tsc --noEmit` deve passar antes de qualquer commit.
- Build local deve passar quando a mudanca afetar UI, rotas, SSR, bundling ou dependencias.
- Mudancas de schema pedem migration versionada e impacto mapeado.

## 3. Regras de release

- Toda release atualiza junto:
  - `app/config/version.ts`
  - `app/routes/changelog.tsx`
  - `UPDATE-LOG.json`
- Historico antigo nao deve ser reescrito para maquiar mudanca de nome, arquitetura ou decisao passada.

## 4. Seguranca operacional

- Nenhuma API key pode ser commitada.
- Confirmacao explicita continua obrigatoria para delete, migration, deploy e acao irreversivel.
- O runtime oficial do agente se chama `Hermes Agent`.
- Identificadores legados com `openclaw` podem permanecer apenas onde a compatibilidade tecnica exigir.

## 5. Qualidade de produto

- UI e comentarios em portugues brasileiro.
- O SaaS deve evitar visual generico; mudancas grandes de UX precisam declarar hierarquia, estados e impacto mobile.
- Respostas e automacoes do agente precisam diferenciar dado real, inferencia e proximo passo.

## 6. Uso do fluxo spec

- Specs sao obrigatorias para epicos e mudancas transversais.
- Bugs pequenos e ajustes locais podem seguir fluxo direto, sem burocracia extra.
- Toda spec precisa declarar escopo, nao-escopo, risco, criterio de pronto e rollback quando houver operacao real.
