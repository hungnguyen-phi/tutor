# syntax=docker/dockerfile:1
# AI Tutor web — build static export (Next output:"export") rồi phục vụ bằng nginx.
# KHÔNG có Node runtime ở prod: backend nằm ở Supabase Edge Functions; image runtime
# CHỈ file tĩnh + nginx (không mang node_modules/.next → gọn sẵn). Build từ REPO ROOT.

# ── build ─────────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build
RUN corepack enable
WORKDIR /repo

# 1) MANIFEST TRƯỚC → layer cài deps tái dùng khi chỉ code đổi (playbook §5 đòn 1 +
#    §6.2 monorepo). Cache-mount giữ store pnpm giữa các build; --filter @tutor/web...
#    chỉ cài deps của web (+ @tutor/shared), bỏ qua cas/db/llm-gateway/pedagogy.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/cas/package.json packages/cas/
COPY packages/db/package.json packages/db/
COPY packages/llm-gateway/package.json packages/llm-gateway/
COPY packages/pedagogy/package.json packages/pedagogy/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @tutor/web...

# 2) Source + build. Public config bake lúc build (bỏ trống = fallback trong code:
#    lib/config.ts + next.config.mjs, đang trỏ Supabase project mới).
COPY . .
ARG NEXT_PUBLIC_SUPABASE_URL=""
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=""
# SSO-only (04/09): hai cờ pilot để TRỐNG = tắt (config.ts chỉ bật khi === "true").
ARG NEXT_PUBLIC_PILOT_PASSWORD_LOGIN=""
ARG NEXT_PUBLIC_PILOT_DEMO_ACCOUNTS=""
ARG NEXT_PUBLIC_SCHOOL_EMAIL_DOMAINS=""
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_PILOT_PASSWORD_LOGIN=$NEXT_PUBLIC_PILOT_PASSWORD_LOGIN \
    NEXT_PUBLIC_PILOT_DEMO_ACCOUNTS=$NEXT_PUBLIC_PILOT_DEMO_ACCOUNTS \
    NEXT_PUBLIC_SCHOOL_EMAIL_DOMAINS=$NEXT_PUBLIC_SCHOOL_EMAIL_DOMAINS \
    NODE_ENV=production
RUN pnpm --filter @tutor/web build

# ── serve ─────────────────────────────────────────────────────────────────────
FROM nginx:alpine AS serve
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/out /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1
