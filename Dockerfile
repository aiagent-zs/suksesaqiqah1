# Dibangun di GitHub Actions (.github/workflows/deploy.yml), bukan di VPS:
# `next build` butuh RAM lebih dari yang tersisa di VPS 2 GB, sehingga build di
# sana jatuh ke swap dan memakan ~24 menit. VPS cukup menarik image jadi.

FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# NEXT_PUBLIC_* ditanam ke bundle saat build, jadi harus ada di sini, bukan
# hanya di env runtime Dokploy. Halaman depan juga prerender katalog dari
# Supabase saat build. Nilainya publik; kunci rahasia tidak pernah masuk sini.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_WHATSAPP_NUMBER
ARG NEXT_PUBLIC_INSTAGRAM_URL
ARG NEXT_PUBLIC_CONTACT_EMAIL
ARG NEXT_PUBLIC_CHATBOT_ENABLED
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
