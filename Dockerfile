FROM node:22-alpine AS builder
WORKDIR /app
COPY postal-multivendor-backend/package*.json ./
COPY postal-multivendor-backend/tsconfig.json ./
RUN npm ci
COPY postal-multivendor-backend/src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY postal-multivendor-backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
ENV NODE_ENV=production
ENV PORT=8001
EXPOSE 8001
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:8001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
CMD ["node", "dist/index.js"]
