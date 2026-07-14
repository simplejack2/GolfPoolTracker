import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    setupFiles: ["./vitest.setup.ts"],
    // Integration tests share one physical Postgres test DB and truncate
    // it in beforeEach; running test files in parallel would let one
    // file's reset wipe rows another file just inserted.
    fileParallelism: false,
  },
});
