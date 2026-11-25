import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    typecheck: { enabled: true, include: ["test/**/*.test.ts"] },
    coverage: {
      provider: "istanbul",
      include: ["src/ladder.ts"],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
