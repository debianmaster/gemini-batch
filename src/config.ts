import { promises as fs } from "fs";
import { homedir } from "os";
import { join } from "path";
import { z } from "zod";
import type { GeminiBatchConfig } from "./types.js";
import { logger } from "./utils.js";

const DEFAULT_MODE = "gemini-2.5-flash";

const ConfigSchema = z.object({
  gemini: z
    .object({
      apiKey: z.string().optional(),
      model: z.string().optional().default(DEFAULT_MODE),
    })
    .default({ model: DEFAULT_MODE }),
});

export class Config {
  private config: GeminiBatchConfig;
  configDir: string;
  configFile: string;

  constructor() {
    this.configDir = join(homedir(), ".gemini-batch");
    this.configFile = join(this.configDir, "config.json");
    this.config = ConfigSchema.parse({}) as GeminiBatchConfig;
  }

  async load(): Promise<void> {
    try {
      const configData = await fs.readFile(this.configFile, "utf-8");
      this.config = ConfigSchema.parse(
        JSON.parse(configData),
      ) as GeminiBatchConfig;
    } catch (error) {
      // Config file doesn't exist or is invalid, use defaults
      this.config = ConfigSchema.parse({}) as GeminiBatchConfig;
    }
  }

  async save(): Promise<void> {
    try {
      await fs.mkdir(this.configDir, { recursive: true });
      await fs.writeFile(this.configFile, JSON.stringify(this.config, null, 2));
    } catch (error) {
      logger.error(`Failed to save config: ${error}`);
    }
  }

  getConfig(): GeminiBatchConfig {
    return this.config;
  }

  getApiKey(): string | undefined {
    return (
      this.config.apiKey ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY
    );
  }

  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
  }

  getModel(): string {
    return this.config.model || "gemini-2.0-flash-exp";
  }

  setModel(model: string): void {
    this.config.model = model;
  }
}

export const config = new Config();
