# AI Tutor web — build static export (Next output:"export") rồi phục vụ bằng
# nginx. KHÔNG có Node runtime ở prod: mọi backend nằm ở Supabase Edge Functions;
# image chỉ là file tĩnh + web server. Build từ REPO ROOT (monorepo pnpm).

# ── build ─────────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

# Cả workspace (apps/web cần @tutor/shared). .dockerignore đã loại node_modules/.next/out.
COPY . .
RUN pnpm install --frozen-lockfile

# Public config bake vào lúc build. Bỏ trống → dùng fallback trong code
# (lib/config.ts + next.config.mjs, đang trỏ Supabase project mới).
ARG NEXT_PUBLIC_SUPABASE_URL=""
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=""
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NODE_ENV=production
RUN pnpm --filter @tutor/web build

# ── serve ─────────────────────────────────────────────────────────────────────
FROM nginx:alpine AS serve
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/out /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1
