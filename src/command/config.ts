import { config } from "../config.js";
import { logger, maskApiKey } from "../utils.js";

export async function handleConfigList(): Promise<void> {
  await config.load();
  const cfg = config.getConfig();

  logger.info("Current Configuration:");
  logger.log("");
  logger.log("API Key:");
  logger.log(`  Gemini: ${maskApiKey(config.getApiKey() || "")}`);
  logger.log("");
  logger.log("Model:");
  logger.log(`  Gemini: ${config.getModel()}`);
  logger.log("");
  logger.log("Settings:");
  logger.log(`  Max Concurrent Jobs: ${cfg.maxConcurrentJobs}`);
  logger.log(`  Check Interval: ${cfg.checkInterval} seconds`);
}

export async function handleConfigSetKey(key: string): Promise<void> {
  await config.load();
  config.setApiKey(key);
  await config.save();
  logger.success("Gemini API key set successfully");
}

export async function handleConfigSetModel(model: string): Promise<void> {
  await config.load();
  config.setModel(model);
  await config.save();
  logger.success(`Gemini model set to: ${model}`);
}

export async function handleConfigReset(): Promise<void> {
  await config.load();
  const cfg = config.getConfig();
  cfg.gemini = { model: "gemini-2.0-flash-exp" };
  cfg.maxConcurrentJobs = 5;
  cfg.checkInterval = 5;
  await config.save();
  logger.warn("Configuration reset to defaults");
}
