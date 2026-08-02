# ---- build ----------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Install with dev deps so `nest build` and the TS compiler are available.
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Drop dev dependencies from node_modules so they aren't copied into runtime.
RUN npm prune --omit=dev

# ---- runtime --------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# bcrypt and pg are prebuilt for musl by npm; no toolchain needed at runtime.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
# SQL migrations are read at boot by dist/database/migrate.js.
COPY --from=build /app/drizzle ./drizzle

# Run as the unprivileged user that ships with the node image.
USER node

EXPOSE 3000

# Apply pending migrations, then boot. Drizzle's migrator takes a Postgres
# advisory lock, so concurrent instances starting together is safe.
CMD ["sh", "-c", "node dist/database/migrate.js && node dist/main"]
