# ---- build stage ----
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# ---- runtime stage ----
FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
