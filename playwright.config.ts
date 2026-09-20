import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const PUERTO = Number(process.env.PORT ?? 3100);
const BASE_URL = `http://127.0.0.1:${PUERTO}`;

// Algunos entornos (contenedores de CI) ya traen Chromium instalado aparte.
const chromiumDelSistema = "/opt/pw-browsers/chromium";
const executablePath = existsSync(chromiumDelSistema) ? chromiumDelSistema : undefined;

/*
 * Los tests de humo no necesitan un Supabase real: la landing y el ingreso
 * renderizan igual. Los flujos que sí tocan la base llegan en las fases
 * siguientes y usan un proyecto de prueba.
 */
const ENV_DE_PRUEBA = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "anon-de-prueba",
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "service-de-prueba",
  RATE_LIMIT_SALT: process.env.RATE_LIMIT_SALT ?? "sal-de-prueba",
  NEXT_PUBLIC_SITE_URL: BASE_URL,
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: { baseURL: BASE_URL, trace: "on-first-retry" },
  projects: [
    {
      name: "celular",
      use: { ...devices["Pixel 7"], launchOptions: { executablePath } },
    },
    {
      name: "escritorio",
      use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } },
    },
  ],
  webServer: {
    command: `pnpm build && pnpm start --port ${PUERTO}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: ENV_DE_PRUEBA,
  },
});
