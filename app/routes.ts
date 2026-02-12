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
    route("settings", "routes/settings.tsx"),
  ]),

  // API routes
  route("logout", "routes/logout.tsx"),
  route("api/theme", "routes/api.theme.tsx"),
  route("api/locale", "routes/api.locale.tsx"),
] satisfies RouteConfig;
