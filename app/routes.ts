import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  // Public routes
  route("login", "routes/login.tsx"),

  // Authenticated routes with app layout
  layout("routes/app-layout.tsx", [
    index("routes/dashboard.tsx"),
    route("crm", "routes/crm.tsx"),
    route("crm/new", "routes/crm-new.tsx"),
    route("crm/:id", "routes/crm-detail.tsx"),
    route("crm/:id/edit", "routes/crm-edit.tsx"),
    route("processes", "routes/processes.tsx"),
    route("processes/new", "routes/processes-new.tsx"),
    route("processes/:id", "routes/processes-detail.tsx"),
    route("processes/:id/edit", "routes/processes-edit.tsx"),
    route("calculator", "routes/calculator.tsx"),
    route("ncm", "routes/ncm.tsx"),
    route("financial", "routes/financial.tsx"),
    route("financial/new", "routes/financial-new.tsx"),
    route("financial/:id", "routes/financial-detail.tsx"),
    route("settings", "routes/settings.tsx"),
    route("agents", "routes/agents.tsx"),
    route("automations", "routes/automations.tsx"),
    route("crm/pipeline", "routes/crm-pipeline.tsx"),
  ]),

  // API routes
  route("logout", "routes/logout.tsx"),
  route("api/theme", "routes/api.theme.tsx"),
  route("api/locale", "routes/api.locale.tsx"),
  route("api/exchange-rate", "routes/api.exchange-rate.tsx"),
  route("api/document/:id/download", "routes/api.document-download.tsx"),
  route("api/chat", "routes/api.chat.tsx"),
  route("api/enrich-cnpj", "routes/api.enrich-cnpj.tsx"),
  route("api/ncm-taxes", "routes/api.ncm-taxes.tsx"),
  route("api/health", "routes/api.health.tsx"),
  route("api/notifications", "routes/api.notifications.tsx"),
  route("api/telegram-webhook", "routes/api.telegram-webhook.tsx"),

  // Catch-all 404
  route("*", "routes/$.tsx"),
] satisfies RouteConfig;
