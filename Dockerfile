# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# PUBLIC_* are inlined at build time ($env/static/public)
ARG PUBLIC_API_BASE_URL
ARG PUBLIC_CLOUDFLARE_KEY
ENV PUBLIC_API_BASE_URL=$PUBLIC_API_BASE_URL
ENV PUBLIC_CLOUDFLARE_KEY=$PUBLIC_CLOUDFLARE_KEY

RUN npm run build
RUN npm prune --omit=dev

# ---- runtime stage ----
FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=6000

COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

EXPOSE 6000
CMD ["node", "build"]