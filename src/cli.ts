import "dotenv/config";
import path from "node:path";
import { Command } from "commander";
import packageJson from "../package.json" with { type: "json" };
import * as configCmd from "./command/config.js";
import * as file from "./command/file.js";
import * as job from "./command/job.js";
import { config } from "./config.js";
import { logger } from "./utils.js";

const program = new Command();

program
  .name("gemini-batch")
  .description("Batch processing for Google Gemini AI")
  .version(packageJson.version);

// Config commands
const configCommand = program
  .command("config")
  .description("Configuration management");

configCommand
  .command("list")
  .description("List current configuration")
  .action(async () => {
    await configCmd.handleConfigList();
  });

configCommand
  .command("set-key")
  .description("Set Gemini API key")
  .argument("<apiKey>", "Your gemini API key")
  .action(async (apiKey: string) => {
    await configCmd.handleConfigSetKey(apiKey);
  });

configCommand
  .command("set-model")
  .description("Set default model")
  .argument("<model>", "Your default gemini model")
  .action(async (model: string) => {
    await configCmd.handleConfigSetModel(model);
  });

// Job commands
const jobCommand = program.command("job").description("Job management");

jobCommand
  .command("list")
  .description("List jobs")
  .option("-n, --limit <num>", "Number of jobs to display", "20")
  .action(async (options) => {
    await job.handleJobList({ limit: parseInt(options.limit) });
  });

jobCommand
  .command("submit")
  .description("Submit batch processing job")
  .argument(
    "[input]",
    "Path to input JSONL file or existing file ID (starts with 'files/')",
  )
  .option("--json", "Output in JSON format")
  .action(async (input: string, options) => {
    if (options.json) {
      logger.setSilent(true);
    }
    const result = await job.handleJobSubmit(input, options);
    if (!result) {
      process.exit(1);
    }
  });

jobCommand
  .command("cancel")
  .description("Cancel job")
  .argument("<jobId>", "ID of the job to cancel")
  .action(async (jobId: string) => {
    const result = await job.handleJobCancel(jobId);
    if (!result) {
      process.exit(1);
    }
  });

jobCommand
  .command("get")
  .description("Get job details")
  .argument("<jobId>", "ID of the job to get")
  .option("--json", "Output in JSON format")
  .action(async (jobId: string, options) => {
    if (options.json) {
      logger.setSilent(true);
    }
    const result = await job.handleJobGet(jobId, options);
    if (!result) {
      process.exit(1);
    }
  });

jobCommand
  .command("download")
  .description("Download job result")
  .argument("<jobId>", "ID of the job to download results for")
  .option("-o, --output <dir>", "Output directory for results")
  .option("--json", "Output in JSON format")
  .action(async (jobId: string, options) => {
    if (options.json) {
      logger.setSilent(true);
    }
    await config.load();
    const result = await job.handleJobDownload(jobId, {
      output: options.output ?? path.resolve(config.configDir, "results"),
      json: options.json,
    });
    if (!result) {
      process.exit(1);
    }
  });

// File commands
const fileCommand = program.command("file").description("File management");

fileCommand
  .command("list")
  .description("List files")
  .option("-n, --limit <num>", "Number of files to display", "10")
  .action(async (options) => {
    await file.handleFileList({ limit: parseInt(options.limit) });
  });

fileCommand
  .command("get")
  .description("Get file details")
  .argument("<fileName>", "Name or display name of the file")
  .action(async (fileName: string) => {
    const result = await file.handleFileGet(fileName);
    if (!result) {
      process.exit(1);
    }
  });

fileCommand
  .command("create")
  .description("Create a new jsonl file for batch processing")
  .requiredOption(
    "-p, --prompt <prompt_or_path>",
    "Prompt text or path to prompt file",
  )
  .requiredOption(
    "-i, --input <input>",
    "File glob pattern (e.g., './input/*.md') or JSON array field (e.g., 'data.json:items')",
  )
  .requiredOption("-o, --output <path>", "Output JSONL file path")
  .action(async (options) => {
    await config.load();
    const result = await file.handleFileCreate({
      ...options,
      model: config.getModel(),
    });
    if (!result) {
      process.exit(1);
    }
  });

program.parse();
