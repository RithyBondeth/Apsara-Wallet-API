import {
  defineRailway,
  github,
  preserve,
  project,
  service,
} from "railway/iac";

// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "apsara-wallet-api";

export default defineRailway(() => {
  const apsara_wallet_api = service("apsara-wallet-api", {
    source: github("RithyBondeth/Apsara-Wallet-API", { branch: "main" }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "Dockerfile",
    },
    healthcheck: "/api/v1/health",
    healthcheckTimeout: 60,
    deploy: {
      // Restart policy is ON_FAILURE, Railway's default. Railway doesn't store
      // the default, so declaring it here would show as drift on every plan.
      restartPolicyMaxRetries: 3,
    },
    env: {
      NODE_ENV: "production",
      // Postgres is not declared in this partial, so reference it by name.
      DATABASE_URL: "${{Postgres.DATABASE_URL}}",
      JWT_ACCESS_TTL: "15m",
      JWT_REFRESH_TTL: "30d",
      // Secrets live only in Railway; preserve() keeps the current value.
      JWT_ACCESS_SECRET: preserve(),
      JWT_REFRESH_SECRET: preserve(),
    },
  });
  return project("Apsara Wallet", {
    resources: [apsara_wallet_api],
  });
});
