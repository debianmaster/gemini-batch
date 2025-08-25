import { config } from "../config.js";
import { logger, maskApiKey } from "../utils.js";

export async function handleConfigList(): Promise<void> {
  await config.load();

  logger.info("Current Configuration:");
  logger.log("");
  logger.log("API Key:");
  logger.log(`  Gemini: ${maskApiKey(config.getApiKey() || "")}`);
  logger.log("");
  logger.log("Model:");
  logger.log(`  Gemini: ${config.getModel()}`);
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
