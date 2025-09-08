import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/cli.ts", "./src/index.ts"],
  platform: "node",
  dts: {
    oxc: true,
  },
});
