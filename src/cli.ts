import "dotenv/config";
import path from "node:path";
import { Command } from "commander";
import * as configCmd from "./command/config.js";
import * as file from "./command/file.js";
import * as job from "./command/job.js";
import { config } from "./config.js";

const program = new Command();

program
  .name("gemini-batch")
  .description("Batch processing for Google Gemini AI")
  .version("1.0.0");

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
  .argument("[input]", "Path to input JSONL file")
  .action(async (input: string) => {
    await job.handleJobSubmit(input);
  });

jobCommand
  .command("cancel")
  .description("Cancel job")
  .argument("<jobId>", "ID of the job to cancel")
  .action(async (jobId: string) => {
    await job.handleJobCancel(jobId);
  });

jobCommand
  .command("get")
  .description("Get job details")
  .argument("<jobId>", "ID of the job to get")
  .action(async (jobId: string) => {
    await job.handleJobGet(jobId);
  });

jobCommand
  .command("download")
  .description("Download job result")
  .argument("<jobId>", "ID of the job to download results for")
  .option("-o, --output <dir>", "Output directory for results")
  .action(async (jobId: string, options) => {
    await config.load();
    await job.handleJobDownload(jobId, {
      output: options.output ?? path.resolve(config.configDir, "results"),
    });
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
    await file.handleFileGet(fileName);
  });

fileCommand
  .command("create")
  .description("Create a new jsonl file for batch processing")
  .requiredOption(
    "-p, --prompt <prompt or path>",
    "Prompt text or path to prompt file",
  )
  .requiredOption(
    "-i, --input <input>",
    "File glob pattern (e.g., './input/*.md') or JSON array field (e.g., 'data.json:items')",
  )
  .requiredOption("-o, --output <path>", "Output JSONL file path")
  .option(
    "--response-schema <path>",
    "Path to JSON file containing response schema for structured output",
  )
  .action(async (options) => {
    await config.load();
    await file.handleFileCreate({
      ...options,
      model: config.getModel(),
    });
  });

program.parse();
