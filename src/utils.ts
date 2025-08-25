import chalk from "chalk";
import ora, { type Ora } from "ora";

export class Logger {
  private verbose: boolean;

  constructor(options?: { verbose: boolean }) {
    this.verbose = options?.verbose || false;
  }

  setVerbose(v: boolean) {
    this.verbose = v;
  }

  info(message: string): void {
    if (this.verbose) {
      console.log(chalk.blue("ℹ"), message);
    }
  }

  success(message: string): void {
    console.log(chalk.green("✓"), message);
  }

  warn(message: string): void {
    console.log(chalk.yellow("⚠"), message);
  }

  error(message: string): void {
    console.log(chalk.red("✗"), message);
  }

  log(message: string): void {
    console.log(message);
  }
}

export const logger = new Logger({ verbose: true });

export function createSpinner(text: string): Ora {
  return ora({
    text,
    spinner: "dots",
  });
}

export function formatProvider(provider: string): string {
  switch (provider.toLowerCase()) {
    case "openai":
      return chalk.green(provider);
    case "gemini":
      return chalk.blue(provider);
    case "anthropic":
      return chalk.magenta(provider);
    default:
      return chalk.gray(provider);
  }
}

export function formatDate(t: number | string): string {
  return new Date(t).toLocaleString();
}

export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length <= 8) return "Not set";
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}
