import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  server: { port: 5173 },
  build: { outDir: "dist" },
  test: {
    environment: "jsdom",
    setupFiles: fileURLToPath(new URL("./src/test/setup.ts", import.meta.url)),
    include: ["./src/**/*.test.{ts,tsx}"],
  },
});
