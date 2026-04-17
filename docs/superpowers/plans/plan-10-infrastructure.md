# Plan 10: Infrastructure & Deployment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Build the complete deployment infrastructure — Docker multi-stage build, nginx reverse proxy, supervisor process management, asset caching, observability, and CI configuration.

**Architecture:** Multi-stage Docker build (build stage, prod-deps stage, final runtime with nginx + supervisor). nginx reverse proxy routes `/assets/` and `/_assets/` to master (port 3000), `/w{0-40}/*` to workers (3001-3041). Supervisor manages nginx + node processes. OpenTelemetry for metrics. Asset fingerprinting with immutable cache headers.

**Tech Stack:** Docker, nginx, supervisor, OpenTelemetry, ESLint, Prettier, Husky, Winston

---

## Task 1: Dockerfile — Multi-stage Build

**Files:**
- `Dockerfile`
- `.dockerignore`

**Checklist:**
- [ ] Stage 1 (`build`): `node:24-slim`, copy `package*.json`, `npm ci`, copy source, run `npm run build-prod`
- [ ] Stage 2 (`deps`): `node:24-slim`, copy `package*.json`, `npm ci --omit=dev`
- [ ] Stage 3 (`final`): `node:24-slim`, install `nginx`, `curl`, `supervisor`, copy built output + prod deps, create `node` user, set entrypoint
- [ ] `.dockerignore` excludes `node_modules`, `.git`, `dist`, `docs`, `*.md`

```dockerfile
# ---- Stage 1: Build ----
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build-prod

# ---- Stage 2: Production Dependencies ----
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- Stage 3: Final Runtime ----
FROM node:24-slim AS final

RUN apt-get update && \
    apt-get install -y --no-install-recommends nginx curl supervisor && \
    rm -rf /var/lib/apt/lists/*

RUN groupadd -r node && useradd -r -g node -m node

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

COPY nginx.conf /etc/nginx/nginx.conf
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost/api/health || exit 1

ENTRYPOINT ["/app/start.sh"]
```

```dockerignore
node_modules
.git
dist
docs
*.md
.env*
.DS_Store
coverage
.nyc_output
```

**Build command:** `docker build -t galacticfront .`

**Commit:** `feat(infra): add multi-stage Dockerfile and .dockerignore`

---

## Task 2: nginx.conf — Reverse Proxy Configuration

**Files:**
- `nginx.conf`

**Checklist:**
- [ ] Worker connections 1024, multi_accept on
- [ ] `/assets/` and `/_assets/` proxy to master on port 3000
- [ ] `/w0/` through `/w40/` proxy to workers on ports 3001-3041
- [ ] WebSocket upgrade support (`Upgrade`, `Connection` headers)
- [ ] Static asset caching: JS/CSS 1 year immutable, HTML 1 second, binary assets 1 year
- [ ] `/api/health` returns no-cache headers
- [ ] Access log off for health checks
- [ ] Gzip enabled for text types

```nginx
worker_processes auto;
pid /run/nginx.pid;

events {
    worker_connections 1024;
    multi_accept on;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    sendfile    on;
    tcp_nopush  on;
    tcp_nodelay on;
    keepalive_timeout 65;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_min_length 256;

    # ---- Logging ----
    log_format main '$remote_addr - $remote_user [$time_local] '
                    '"$request" $status $body_bytes_sent '
                    '"$http_referer" "$http_user_agent"';
    access_log /var/log/nginx/access.log main;
    error_log  /var/log/nginx/error.log warn;

    # ---- Upstream: Master ----
    upstream master {
        server 127.0.0.1:3000;
    }

    # ---- Upstreams: Workers 0-40 ----
    upstream worker0  { server 127.0.0.1:3001; }
    upstream worker1  { server 127.0.0.1:3002; }
    upstream worker2  { server 127.0.0.1:3003; }
    upstream worker3  { server 127.0.0.1:3004; }
    upstream worker4  { server 127.0.0.1:3005; }
    upstream worker5  { server 127.0.0.1:3006; }
    upstream worker6  { server 127.0.0.1:3007; }
    upstream worker7  { server 127.0.0.1:3008; }
    upstream worker8  { server 127.0.0.1:3009; }
    upstream worker9  { server 127.0.0.1:3010; }
    upstream worker10 { server 127.0.0.1:3011; }
    upstream worker11 { server 127.0.0.1:3012; }
    upstream worker12 { server 127.0.0.1:3013; }
    upstream worker13 { server 127.0.0.1:3014; }
    upstream worker14 { server 127.0.0.1:3015; }
    upstream worker15 { server 127.0.0.1:3016; }
    upstream worker16 { server 127.0.0.1:3017; }
    upstream worker17 { server 127.0.0.1:3018; }
    upstream worker18 { server 127.0.0.1:3019; }
    upstream worker19 { server 127.0.0.1:3020; }
    upstream worker20 { server 127.0.0.1:3021; }
    upstream worker21 { server 127.0.0.1:3022; }
    upstream worker22 { server 127.0.0.1:3023; }
    upstream worker23 { server 127.0.0.1:3024; }
    upstream worker24 { server 127.0.0.1:3025; }
    upstream worker25 { server 127.0.0.1:3026; }
    upstream worker26 { server 127.0.0.1:3027; }
    upstream worker27 { server 127.0.0.1:3028; }
    upstream worker28 { server 127.0.0.1:3029; }
    upstream worker29 { server 127.0.0.1:3030; }
    upstream worker30 { server 127.0.0.1:3031; }
    upstream worker31 { server 127.0.0.1:3032; }
    upstream worker32 { server 127.0.0.1:3033; }
    upstream worker33 { server 127.0.0.1:3034; }
    upstream worker34 { server 127.0.0.1:3035; }
    upstream worker35 { server 127.0.0.1:3036; }
    upstream worker36 { server 127.0.0.1:3037; }
    upstream worker37 { server 127.0.0.1:3038; }
    upstream worker38 { server 127.0.0.1:3039; }
    upstream worker39 { server 127.0.0.1:3040; }
    upstream worker40 { server 127.0.0.1:3041; }

    # ---- Map for WebSocket upgrade ----
    map $http_upgrade $connection_upgrade {
        default upgrade;
        ''      close;
    }

    server {
        listen 80 default_server;
        server_name _;

        # ---- Health endpoint (no-cache, no access log) ----
        location = /api/health {
            access_log off;
            add_header Cache-Control "no-store, no-cache, must-revalidate";
            proxy_pass http://master;
        }

        # ---- Static assets: fingerprinted JS/CSS (1 year immutable) ----
        location ~* \.(js|css)$ {
            add_header Cache-Control "public, max-age=31536000, immutable";
            proxy_pass http://master;
        }

        # ---- Static assets: binary (images, fonts, audio — 1 year) ----
        location ~* \.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|mp3|ogg|wav|webp|avif)$ {
            add_header Cache-Control "public, max-age=31536000, immutable";
            proxy_pass http://master;
        }

        # ---- HTML (1 second cache — always revalidate) ----
        location ~* \.html$ {
            add_header Cache-Control "public, max-age=1, must-revalidate";
            proxy_pass http://master;
        }

        # ---- Asset paths to master ----
        location /assets/ {
            proxy_pass http://master;
        }

        location /_assets/ {
            proxy_pass http://master;
        }

        # ---- Worker routes: /w0/ through /w40/ ----
        location /w0/  { proxy_pass http://worker0;  proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w1/  { proxy_pass http://worker1;  proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w2/  { proxy_pass http://worker2;  proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w3/  { proxy_pass http://worker3;  proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w4/  { proxy_pass http://worker4;  proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w5/  { proxy_pass http://worker5;  proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w6/  { proxy_pass http://worker6;  proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w7/  { proxy_pass http://worker7;  proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w8/  { proxy_pass http://worker8;  proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w9/  { proxy_pass http://worker9;  proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w10/ { proxy_pass http://worker10; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w11/ { proxy_pass http://worker11; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w12/ { proxy_pass http://worker12; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w13/ { proxy_pass http://worker13; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w14/ { proxy_pass http://worker14; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w15/ { proxy_pass http://worker15; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w16/ { proxy_pass http://worker16; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w17/ { proxy_pass http://worker17; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w18/ { proxy_pass http://worker18; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w19/ { proxy_pass http://worker19; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w20/ { proxy_pass http://worker20; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w21/ { proxy_pass http://worker21; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w22/ { proxy_pass http://worker22; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w23/ { proxy_pass http://worker23; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w24/ { proxy_pass http://worker24; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w25/ { proxy_pass http://worker25; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w26/ { proxy_pass http://worker26; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w27/ { proxy_pass http://worker27; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real_IP $remote_addr; }
        location /w28/ { proxy_pass http://worker28; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w29/ { proxy_pass http://worker29; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w30/ { proxy_pass http://worker30; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w31/ { proxy_pass http://worker31; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w32/ { proxy_pass http://worker32; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w33/ { proxy_pass http://worker33; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w34/ { proxy_pass http://worker34; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w35/ { proxy_pass http://worker35; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w36/ { proxy_pass http://worker36; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w37/ { proxy_pass http://worker37; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w38/ { proxy_pass http://worker38; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w39/ { proxy_pass http://worker39; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /w40/ { proxy_pass http://worker40; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }

        # ---- Default: proxy to master ----
        location / {
            proxy_pass http://master;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

**Commit:** `feat(infra): add nginx reverse proxy config with worker routing`

---

## Task 3: supervisord.conf — Process Management

**Files:**
- `supervisord.conf`

**Checklist:**
- [ ] Nodaemon mode (foreground for Docker)
- [ ] nginx program — runs as root (required for port 80), autorestart
- [ ] node server program — runs as `node` user, autorestart, stderr redirect to stdout
- [ ] Priority ordering: nginx starts first, then node

```ini
[supervisord]
nodaemon=true
user=root
logfile=/var/log/supervisor/supervisord.log
pidfile=/var/run/supervisord.pid
childlogdir=/var/log/supervisor

[program:nginx]
command=/usr/sbin/nginx -g "daemon off;"
autostart=true
autorestart=true
priority=10
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0

[program:node]
command=node /app/dist/server/main.js
directory=/app
user=node
autostart=true
autorestart=true
priority=20
environment=NODE_ENV="production",PORT="3000"
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stdout
stderr_logfile_maxbytes=0
```

**Commit:** `feat(infra): add supervisord config for nginx + node`

---

## Task 4: start.sh — Entrypoint Script

**Files:**
- `start.sh`

**Checklist:**
- [ ] Create log directories
- [ ] Ensure nginx directories exist
- [ ] Run supervisord in foreground

```bash
#!/usr/bin/env bash
set -euo pipefail

# Ensure log directories exist
mkdir -p /var/log/supervisor
mkdir -p /var/log/nginx

# Ensure nginx runtime dirs exist
mkdir -p /var/lib/nginx/body
mkdir -p /run/nginx

echo "[start.sh] Starting GalacticFront via supervisord..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
```

**Commit:** `feat(infra): add start.sh entrypoint script`

---

## Task 5: ESLint Configuration

**Files:**
- `eslint.config.js`

**Checklist:**
- [ ] Flat config format (ESLint 9+)
- [ ] `typescript-eslint` parser and plugin
- [ ] `prefer-nullish-coalescing` rule enabled
- [ ] `eqeqeq` enforced (smart mode)
- [ ] `no-unused-vars` with underscore-prefix ignore pattern
- [ ] Ignore `dist/`, `node_modules/`, `coverage/`

```javascript
// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/", "node_modules/", "coverage/"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      eqeqeq: ["error", "smart"],
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/prefer-nullish-coalescing": "warn",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports" },
      ],
    },
  },
);
```

**Install:**
```bash
npm install -D eslint @eslint/js typescript-eslint
```

**package.json script:**
```json
{
  "scripts": {
    "lint": "eslint . --max-warnings 0",
    "lint:fix": "eslint . --fix"
  }
}
```

**Commit:** `feat(infra): add ESLint flat config with typescript-eslint`

---

## Task 6: Prettier Configuration

**Files:**
- `.prettierrc`
- `.prettierignore`

**Checklist:**
- [ ] Organize-imports plugin configured
- [ ] Trailing commas, single quotes off (double quotes), 100 print width
- [ ] `.prettierignore` mirrors `.dockerignore` + build artifacts

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf",
  "plugins": ["prettier-plugin-organize-imports"]
}
```

```gitignore
# .prettierignore
dist/
node_modules/
coverage/
*.log
package-lock.json
```

**Install:**
```bash
npm install -D prettier prettier-plugin-organize-imports
```

**package.json script:**
```json
{
  "scripts": {
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

**Commit:** `feat(infra): add Prettier config with organize-imports plugin`

---

## Task 7: Husky + lint-staged — Pre-commit Hooks

**Files:**
- `.husky/pre-commit`
- Root `package.json` (lint-staged config)

**Checklist:**
- [ ] Husky installs git hooks via `prepare` script
- [ ] Pre-commit runs lint-staged
- [ ] lint-staged formats `.ts`, `.tsx`, `.js`, `.json`, `.css` via Prettier
- [ ] lint-staged runs ESLint on `.ts`/`.tsx` files

**Install:**
```bash
npm install -D husky lint-staged
npx husky init
```

**`.husky/pre-commit`:**
```bash
npx lint-staged
```

**`package.json` additions:**
```json
{
  "scripts": {
    "prepare": "husky"
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix --max-warnings 0",
      "prettier --write"
    ],
    "*.{js,json,css,md}": [
      "prettier --write"
    ]
  }
}
```

**Commit:** `feat(infra): add Husky pre-commit hooks with lint-staged`

---

## Task 8: OpenTelemetry Setup

**Files:**
- `src/server/infra/OtelResource.ts`
- `src/server/infra/WorkerMetrics.ts`
- `src/server/infra/Logger.ts`

**Checklist:**
- [ ] `OtelResource.ts` — service name `"galacticfront"`, semantic conventions
- [ ] `WorkerMetrics.ts` — gauges for active games, connected clients, desyncs, heap memory; 15-second export interval
- [ ] `Logger.ts` — Winston with JSON transport + OpenTelemetry log correlation

### OtelResource.ts

```typescript
import { Resource } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";

const GIT_COMMIT = process.env.GIT_COMMIT ?? "dev";

export const otelResource = new Resource({
  [ATTR_SERVICE_NAME]: "galacticfront",
  [ATTR_SERVICE_VERSION]: GIT_COMMIT,
  "deployment.environment": process.env.NODE_ENV ?? "development",
});
```

### WorkerMetrics.ts

```typescript
import { MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { otelResource } from "./OtelResource.js";

const exporter = new OTLPMetricExporter({
  url: process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT ?? "http://localhost:4318/v1/metrics",
});

const meterProvider = new MeterProvider({
  resource: otelResource,
  readers: [
    new PeriodicExportingMetricReader({
      exporter,
      exportIntervalMillis: 15_000,
    }),
  ],
});

const meter = meterProvider.getMeter("galacticfront.worker");

// ---- Gauges ----
export const activeGamesGauge = meter.createObservableGauge("gf.active_games", {
  description: "Number of currently active game instances",
});

export const connectedClientsGauge = meter.createObservableGauge("gf.connected_clients", {
  description: "Number of connected WebSocket clients",
});

export const desyncCountGauge = meter.createObservableGauge("gf.desync_count", {
  description: "Number of desync events since last export",
});

export const heapUsedGauge = meter.createObservableGauge("gf.heap_used_bytes", {
  description: "Node.js heap used in bytes",
});

// ---- Register callbacks ----
let _activeGames = 0;
let _connectedClients = 0;
let _desyncCount = 0;

activeGamesGauge.addCallback((result) => result.observe(_activeGames));
connectedClientsGauge.addCallback((result) => result.observe(_connectedClients));
desyncCountGauge.addCallback((result) => result.observe(_desyncCount));
heapUsedGauge.addCallback((result) => result.observe(process.memoryUsage().heapUsed));

export function setActiveGames(n: number): void {
  _activeGames = n;
}

export function setConnectedClients(n: number): void {
  _connectedClients = n;
}

export function incrementDesyncs(): void {
  _desyncCount++;
}

export function resetDesyncs(): void {
  _desyncCount = 0;
}

export async function shutdownMetrics(): Promise<void> {
  await meterProvider.shutdown();
}
```

### Logger.ts

```typescript
import { createLogger, format, transports } from "winston";

const isProduction = process.env.NODE_ENV === "production";

export const logger = createLogger({
  level: isProduction ? "info" : "debug",
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DDTHH:mm:ss.SSSZ" }),
    format.errors({ stack: true }),
    isProduction
      ? format.json()
      : format.combine(format.colorize(), format.simple()),
  ),
  defaultMeta: {
    service: "galacticfront",
    commit: process.env.GIT_COMMIT ?? "dev",
  },
  transports: [new transports.Console()],
});

export function childLogger(meta: Record<string, unknown>) {
  return logger.child(meta);
}
```

**Install:**
```bash
npm install @opentelemetry/resources @opentelemetry/semantic-conventions \
  @opentelemetry/sdk-metrics @opentelemetry/exporter-metrics-otlp-http \
  winston
```

**Commit:** `feat(infra): add OpenTelemetry metrics + Winston logger`

---

## Task 9: PublicAssetManifest — Build-time Hash Generation

**Files:**
- `src/server/infra/PublicAssetManifest.ts`

**Checklist:**
- [ ] Reads build output directory, computes content hashes for each file
- [ ] Generates `asset-manifest.json` mapping original filenames to fingerprinted filenames
- [ ] Runs as a post-build step

```typescript
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync, renameSync } from "node:fs";
import { join, extname, basename, dirname } from "node:path";

export interface AssetManifest {
  [originalPath: string]: string;
}

function walkDir(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

function hashFile(filePath: string): string {
  const content = readFileSync(filePath);
  return createHash("sha256").update(content).digest("hex").slice(0, 12);
}

export function buildAssetManifest(distDir: string, outputPath: string): AssetManifest {
  const manifest: AssetManifest = {};
  const hashableExtensions = new Set([".js", ".css", ".png", ".jpg", ".svg", ".woff2", ".woff"]);

  const files = walkDir(distDir);

  for (const filePath of files) {
    const ext = extname(filePath);
    if (!hashableExtensions.has(ext)) continue;

    const relativePath = filePath.slice(distDir.length);
    const hash = hashFile(filePath);
    const base = basename(filePath, ext);
    const dir = dirname(filePath);
    const hashedName = `${base}.${hash}${ext}`;
    const hashedPath = join(dir, hashedName);

    renameSync(filePath, hashedPath);
    manifest[relativePath] = hashedPath.slice(distDir.length);
  }

  writeFileSync(outputPath, JSON.stringify(manifest, null, 2));
  return manifest;
}

// CLI entry point
if (process.argv[1] === import.meta.filename) {
  const distDir = process.argv[2] ?? join(process.cwd(), "dist", "client");
  const outputPath = process.argv[3] ?? join(process.cwd(), "dist", "asset-manifest.json");
  const manifest = buildAssetManifest(distDir, outputPath);
  console.log(`Asset manifest generated: ${Object.keys(manifest).length} files hashed`);
}
```

**package.json script:**
```json
{
  "scripts": {
    "build-prod": "npm run build && node dist/server/infra/PublicAssetManifest.js dist/client dist/asset-manifest.json"
  }
}
```

**Commit:** `feat(infra): add build-time asset hash manifest generator`

---

## Task 10: RuntimeAssetManifest — Dynamic Path Mapping

**Files:**
- `src/server/infra/RuntimeAssetManifest.ts`

**Checklist:**
- [ ] Loads `asset-manifest.json` at server startup
- [ ] Provides `resolveAsset(originalPath)` for templates
- [ ] Falls back to original path if manifest entry missing (dev mode)

```typescript
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { AssetManifest } from "./PublicAssetManifest.js";
import { logger } from "./Logger.js";

let manifest: AssetManifest = {};

export function loadAssetManifest(manifestPath?: string): void {
  const path = manifestPath ?? join(process.cwd(), "dist", "asset-manifest.json");

  if (!existsSync(path)) {
    logger.warn("Asset manifest not found at %s — using passthrough", path);
    return;
  }

  try {
    manifest = JSON.parse(readFileSync(path, "utf-8")) as AssetManifest;
    logger.info("Loaded asset manifest with %d entries", Object.keys(manifest).length);
  } catch (err) {
    logger.error("Failed to parse asset manifest", { err });
  }
}

export function resolveAsset(originalPath: string): string {
  return manifest[originalPath] ?? originalPath;
}

export function getManifest(): Readonly<AssetManifest> {
  return manifest;
}
```

**Commit:** `feat(infra): add runtime asset manifest resolver`

---

## Task 11: StaticAssetCache — Immutable Headers Middleware

**Files:**
- `src/server/middleware/StaticAssetCache.ts`

**Checklist:**
- [ ] Hashed assets (filename contains content hash) get `Cache-Control: public, max-age=31536000, immutable`
- [ ] Non-hashed assets get shorter cache with revalidation
- [ ] Express middleware function

```typescript
import type { Request, Response, NextFunction } from "express";
import { extname } from "node:path";

const HASHED_PATTERN = /\.[a-f0-9]{8,12}\.(js|css|png|jpg|svg|woff2?)$/;

const IMMUTABLE_EXTENSIONS = new Set([".js", ".css", ".png", ".jpg", ".jpeg", ".svg", ".woff", ".woff2", ".avif", ".webp"]);

export function staticAssetCache(req: Request, res: Response, next: NextFunction): void {
  const ext = extname(req.path);

  if (HASHED_PATTERN.test(req.path)) {
    // Fingerprinted asset — cache forever
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  } else if (IMMUTABLE_EXTENSIONS.has(ext)) {
    // Known static type but not fingerprinted — short cache with revalidation
    res.setHeader("Cache-Control", "public, max-age=3600, must-revalidate");
  }

  next();
}
```

**Commit:** `feat(infra): add static asset cache middleware with immutable headers`

---

## Task 12: NoStoreHeaders — API Cache-Busting Middleware

**Files:**
- `src/server/middleware/NoStoreHeaders.ts`

**Checklist:**
- [ ] Applies `Cache-Control: no-store` to all `/api/` routes
- [ ] Prevents CDN/browser from caching dynamic responses
- [ ] Sets `Pragma: no-cache` for legacy clients

```typescript
import type { Request, Response, NextFunction } from "express";

export function noStoreHeaders(req: Request, res: Response, next: NextFunction): void {
  if (req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
}
```

**Commit:** `feat(infra): add no-store cache headers for API routes`

---

## Task 13: RenderHtml.ts — HTML Template Rendering

**Files:**
- `src/server/infra/RenderHtml.ts`

**Checklist:**
- [ ] Injects `GIT_COMMIT` into HTML
- [ ] Injects serialized `ASSET_MANIFEST` for client-side resolution
- [ ] Injects `gameEnv` config (server URL, feature flags)
- [ ] XSS-safe JSON serialization (escapes `</script>`)

```typescript
import { resolveAsset, getManifest } from "./RuntimeAssetManifest.js";

export interface GameEnv {
  serverUrl: string;
  gitCommit: string;
  wsPath: string;
  features: Record<string, boolean>;
}

function escapeJsonForScript(json: string): string {
  return json
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/'/g, "\\u0027");
}

export function renderHtml(options: {
  title?: string;
  gameEnv: GameEnv;
  ogTags?: string;
}): string {
  const { title = "GalacticFront.io", gameEnv, ogTags = "" } = options;

  const manifest = getManifest();
  const mainJs = resolveAsset("/main.js");
  const mainCss = resolveAsset("/main.css");

  const envJson = escapeJsonForScript(JSON.stringify(gameEnv));
  const manifestJson = escapeJsonForScript(JSON.stringify(manifest));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  ${ogTags}
  <link rel="stylesheet" href="${mainCss}">
  <script>
    window.__GAME_ENV__ = ${envJson};
    window.__ASSET_MANIFEST__ = ${manifestJson};
  </script>
</head>
<body>
  <div id="root"></div>
  <!-- GIT_COMMIT: ${gameEnv.gitCommit} -->
  <script type="module" src="${mainJs}"></script>
</body>
</html>`;
}
```

**Commit:** `feat(infra): add HTML template renderer with config injection`

---

## Task 14: GamePreviewBuilder — OpenGraph Meta Tags

**Files:**
- `src/server/infra/GamePreviewBuilder.ts`

**Checklist:**
- [ ] Generates OG meta tags for game URLs (title, description, image)
- [ ] Supports custom thumbnail per game
- [ ] Twitter card support
- [ ] Falls back to site-wide defaults

```typescript
export interface GamePreview {
  gameId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  playerCount?: number;
}

const DEFAULT_PREVIEW: Omit<GamePreview, "gameId"> = {
  title: "GalacticFront.io",
  description: "Real-time multiplayer space strategy game",
  thumbnailUrl: "/assets/og-default.png",
};

export function buildGameOgTags(preview?: Partial<GamePreview>, siteUrl?: string): string {
  const base = siteUrl ?? "https://galacticfront.io";
  const title = preview?.title ?? DEFAULT_PREVIEW.title;
  const description = preview?.description ?? DEFAULT_PREVIEW.description;
  const image = preview?.thumbnailUrl ?? DEFAULT_PREVIEW.thumbnailUrl;
  const fullImageUrl = image.startsWith("http") ? image : `${base}${image}`;

  const playerSuffix = preview?.playerCount != null ? ` | ${preview.playerCount} players` : "";

  const tags = [
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${escapeAttr(title + playerSuffix)}">`,
    `<meta property="og:description" content="${escapeAttr(description)}">`,
    `<meta property="og:image" content="${escapeAttr(fullImageUrl)}">`,
    `<meta property="og:url" content="${escapeAttr(base)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeAttr(title)}">`,
    `<meta name="twitter:description" content="${escapeAttr(description)}">`,
    `<meta name="twitter:image" content="${escapeAttr(fullImageUrl)}">`,
  ];

  return tags.join("\n  ");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
```

**Commit:** `feat(infra): add OpenGraph meta tag builder for game previews`

---

## Task 15: PollingLoop Utility

**Files:**
- `src/server/infra/PollingLoop.ts`

**Checklist:**
- [ ] Async polling with configurable interval
- [ ] Sequential execution guarantee (next tick waits for current to finish)
- [ ] Graceful stop with async cleanup
- [ ] Error handling — logs but does not crash the loop

```typescript
import { logger } from "./Logger.js";

export interface PollingLoopOptions {
  name: string;
  intervalMs: number;
  fn: () => Promise<void>;
}

export class PollingLoop {
  private readonly name: string;
  private readonly intervalMs: number;
  private readonly fn: () => Promise<void>;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private stopped = false;

  constructor(options: PollingLoopOptions) {
    this.name = options.name;
    this.intervalMs = options.intervalMs;
    this.fn = options.fn;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.stopped = false;
    logger.info("PollingLoop [%s] started (interval=%dms)", this.name, this.intervalMs);
    void this.tick();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer != null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.running = false;
    logger.info("PollingLoop [%s] stopped", this.name);
  }

  private async tick(): Promise<void> {
    if (this.stopped) return;

    try {
      await this.fn();
    } catch (err) {
      logger.error("PollingLoop [%s] error", this.name, { err });
    }

    if (!this.stopped) {
      this.timer = setTimeout(() => void this.tick(), this.intervalMs);
    }
  }
}
```

**Commit:** `feat(infra): add PollingLoop utility with sequential execution`

---

## Task 16: Health Check Endpoints

**Files:**
- `src/server/routes/health.ts`

**Checklist:**
- [ ] `GET /api/health` — returns 200 with `{ status: "ok", uptime, commit }`
- [ ] `GET /api/instance` — returns instance metadata (worker count, memory, node version)
- [ ] Suitable for Docker HEALTHCHECK and load balancer probes

```typescript
import { Router } from "express";

const GIT_COMMIT = process.env.GIT_COMMIT ?? "dev";
const startedAt = Date.now();

export const healthRouter = Router();

healthRouter.get("/api/health", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({
    status: "ok",
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    commit: GIT_COMMIT,
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get("/api/instance", (_req, res) => {
  const mem = process.memoryUsage();
  res.setHeader("Cache-Control", "no-store");
  res.json({
    commit: GIT_COMMIT,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    pid: process.pid,
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    memory: {
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      rssMB: Math.round(mem.rss / 1024 / 1024),
    },
    env: process.env.NODE_ENV ?? "development",
  });
});
```

**Commit:** `feat(infra): add /api/health and /api/instance endpoints`

---

## Dependency Summary

All npm dependencies required across tasks:

**Production:**
```bash
npm install express winston \
  @opentelemetry/resources @opentelemetry/semantic-conventions \
  @opentelemetry/sdk-metrics @opentelemetry/exporter-metrics-otlp-http
```

**Development:**
```bash
npm install -D eslint @eslint/js typescript-eslint \
  prettier prettier-plugin-organize-imports \
  husky lint-staged \
  @types/express @types/node
```

---

## Task Dependency Graph

```
Task 1 (Dockerfile) ──────────────────────┐
Task 2 (nginx.conf) ──────────────────────┤
Task 3 (supervisord.conf) ────────────────┤── All independent, can be parallel
Task 4 (start.sh) ────────────────────────┤
Task 5 (ESLint) ──────────────────────────┤
Task 6 (Prettier) ────────────────────────┤
Task 7 (Husky) ───── depends on 5 + 6 ───┘
Task 8 (OpenTelemetry) ───────────────────┐── Independent
Task 9 (PublicAssetManifest) ─────────────┤
Task 10 (RuntimeAssetManifest) ── dep 9 ──┤
Task 11 (StaticAssetCache) ── dep 9 ──────┤
Task 12 (NoStoreHeaders) ─────────────────┤── Independent
Task 13 (RenderHtml) ── dep 10, 14 ───────┤
Task 14 (GamePreviewBuilder) ─────────────┤── Independent
Task 15 (PollingLoop) ── dep 8 (Logger) ──┤
Task 16 (Health) ─────────────────────────┘── Independent
```

**Parallel groups for subagent dispatch:**
- Group A (no deps): Tasks 1, 2, 3, 4, 5, 6, 8, 9, 12, 14, 16
- Group B (after Group A): Tasks 7 (needs 5+6), 10 (needs 9), 11 (needs 9), 15 (needs 8)
- Group C (after Group B): Task 13 (needs 10+14)

---

## File Tree (final state)

```
GalacticFront/
├── .dockerignore
├── .husky/
│   └── pre-commit
├── .prettierignore
├── .prettierrc
├── Dockerfile
├── eslint.config.js
├── nginx.conf
├── start.sh
├── supervisord.conf
└── src/
    └── server/
        ├── infra/
        │   ├── GamePreviewBuilder.ts
        │   ├── Logger.ts
        │   ├── OtelResource.ts
        │   ├── PollingLoop.ts
        │   ├── PublicAssetManifest.ts
        │   ├── RenderHtml.ts
        │   ├── RuntimeAssetManifest.ts
        │   └── WorkerMetrics.ts
        ├── middleware/
        │   ├── NoStoreHeaders.ts
        │   └── StaticAssetCache.ts
        └── routes/
            └── health.ts
```
