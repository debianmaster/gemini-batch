import chalk from "chalk";
import ora, { type Ora } from "ora";

export class Logger {
  private verbose: boolean;
  spinner: Ora | null = null;

  constructor(options?: { verbose: boolean }) {
    this.verbose = options?.verbose || false;
  }

  setVerbose(v: boolean) {
    this.verbose = v;
  }

  createSpinner(text: string) {
    this.spinner = createSpinner(text);
  }

  stopSpinner() {
    if (this.spinner) {
      this.spinner?.stop();
      this.spinner = null;
    }
  }

  startSpinner() {
    if (this.spinner) {
      this.spinner.start();
    }
  }

  private output(message: string): void {
    if (this.spinner) {
      // 如果有 spinner 在运行，先停止它，输出消息，然后重新启动
      const text = this.spinner.text;
      this.spinner.stop();
      console.log(message);
      this.spinner.text = text;
      this.spinner.start();
    } else {
      console.log(message);
    }
  }

  info(message: string): void {
    this.output(chalk.blue("ℹ") + " " + message);
  }

  success(message: string): void {
    this.output(chalk.green("✓") + " " + message);
  }

  warn(message: string): void {
    this.output(chalk.yellow("⚠") + " " + message);
  }

  error(message: string): void {
    this.output(chalk.red("✗") + " " + message);
  }

  log(message: string): void {
    this.output(message);
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
