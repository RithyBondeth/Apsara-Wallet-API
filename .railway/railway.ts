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
    // The app listens on Railway's injected PORT (8080), not the Dockerfile's
    // EXPOSE 3010, so the domain must target 8080. Railway config can't create
    // a custom domain: add a new one in the dashboard first, then declare it.
    domains: [{ domain: "api-wallet.apsara.social", port: 8080 }],
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
      // Password-reset email. The sender's domain must be verified in Resend.
      RESEND_FROM: "Apsara Wallet <noreply@wallet.apsara.social>",
      RESEND_API_KEY: preserve(),
    },
  });
  return project("Apsara Wallet", {
    resources: [apsara_wallet_api],
  });
});
