# ---------- 1. Dependencias ----------
FROM node:24-alpine AS dependencias
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------- 2. Compilación ----------
FROM node:24-alpine AS compilacion
WORKDIR /app
COPY --from=dependencias /app/node_modules ./node_modules
COPY . .
# Adónde reenvía Next.js las llamadas /api/v1 (queda fijo al compilar).
ARG API_INTERNA=http://api:8000
ENV API_INTERNA=$API_INTERNA NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------- 3. Servidor mínimo (output: standalone) ----------
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=compilacion --chown=node:node /app/.next/standalone ./
COPY --from=compilacion --chown=node:node /app/.next/static ./.next/static
COPY --from=compilacion --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
