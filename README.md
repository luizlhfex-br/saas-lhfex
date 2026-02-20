# Welcome to React Router!

A modern, production-ready template for building full-stack React applications using React Router.

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/remix-run/react-router-templates/tree/main/default)

## Features

- 🚀 Server-side rendering
- ⚡️ Hot Module Replacement (HMR)
- 📦 Asset bundling and optimization
- 🔄 Data loading and mutations
- 🔒 TypeScript by default
- 🎉 TailwindCSS for styling
- 📖 [React Router docs](https://reactrouter.com/)

## Getting Started

### Installation

Install the dependencies:

```bash
npm install
```

### Development

Start the development server with HMR:

```bash
npm run dev
```

Your application will be available at `http://localhost:5173`.

## Building for Production

Create a production build:

```bash
npm run build
```

## Deployment

### Docker Deployment

To build and run using Docker:

```bash
docker build -t my-app .

# Run the container
docker run -p 3000:3000 my-app
```

The containerized application can be deployed to any platform that supports Docker, including:

- AWS ECS
- Google Cloud Run
- Azure Container Apps
- Digital Ocean App Platform
- Fly.io
- Railway

### DIY Deployment

If you're familiar with deploying Node applications, the built-in app server is production-ready.

Make sure to deploy the output of `npm run build`

```
├── package.json
├── package-lock.json (or pnpm-lock.yaml, or bun.lockb)
├── build/
│   ├── client/    # Static assets
│   └── server/    # Server-side code
```

## Styling

This template comes with [Tailwind CSS](https://tailwindcss.com/) already configured for a simple default starting experience. You can use whatever CSS framework you prefer.

---

Built with ❤️ using React Router.

## Post-Incident Hardening (Coolify)

### 1) Continuous healthcheck

- Docker image now exposes a native `HEALTHCHECK` against `http://127.0.0.1:3000/api/health`.
- To watch uptime from outside the container and send Telegram alerts:

```bash
npm run ops:health-watchdog
```

Optional environment variables for watchdog:

- `HEALTHCHECK_URL` (default: `https://saas.lhfex.com.br/api/health`)
- `HEALTHCHECK_INTERVAL_SECONDS` (default: `20`)
- `HEALTHCHECK_FAIL_THRESHOLD` (default: `3`)
- `HEALTHCHECK_APP_NAME` (default: `saas-lhfex`)
- `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` (for down/recovery alerts)

### 2) Restart-loop alert

- Watchdog raises alert when failures are consecutive and reach threshold.
- Recovery message is sent automatically on first successful check after downtime.

### 3) Coolify build/runtime env split

In Coolify, keep `NODE_ENV=production` as **Runtime only** (not build-time), to avoid missing build toolchain/dev dependencies at build step.

Recommended runtime-only vars:

- `NODE_ENV=production`
- `DATABASE_URL`, `SESSION_SECRET`, `ENCRYPTION_KEY`
- `APP_URL`, `SENTRY_DSN`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_ADMIN_USERS`, `TELEGRAM_ALLOWED_USERS`

Build-time vars: only what is strictly required to compile the app.
