import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` sirve para que Next avise si algo del servidor se cuela
      // en el cliente; en los tests de Node no aplica.
      "server-only": fileURLToPath(new URL("./tests/unit/stub-server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
});
