import "dotenv/config";

import { Command } from "commander";
import * as config from "./command/config.js";
import * as file from "./command/file.js";
import * as job from "./command/job.js";

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
    await config.handleConfigList();
  });

configCommand
  .command("set-key <apiKey>")
  .description("Set API key")
  .action(async (apiKey: string) => {
    await config.handleConfigSetKey(apiKey);
  });

configCommand
  .command("set-model <model>")
  .description("Set model")
  .action(async (model: string) => {
    await config.handleConfigSetModel(model);
  });

configCommand
  .command("reset")
  .description("Reset configuration")
  .action(async () => {
    await config.handleConfigReset();
  });

// Job commands
const jobCommand = program.command("job").description("Job management");

jobCommand
  .command("list")
  .description("List jobs")
  .option("--limit <num>", "Number of jobs to display", "20")
  .action(async (options) => {
    await job.handleJobList({ limit: parseInt(options.limit) });
  });

jobCommand
  .command("submit [inputs...]")
  .description("Submit job")
  .option("--output <dir>", "Output directory for results", "./results")
  .option("--max-concurrent <num>", "Maximum concurrent jobs", "5")
  .option("--check-interval <seconds>", "Status check interval in seconds", "5")
  .action(async (inputs: string[], options) => {
    await job.handleJobSubmit(inputs || [], {
      output: options.output,
      maxConcurrent: parseInt(options.maxConcurrent),
      checkInterval: parseInt(options.checkInterval),
    });
  });

jobCommand
  .command("cancel <jobId>")
  .description("Cancel job")
  .action(async (jobId: string) => {
    await job.handleJobCancel(jobId);
  });

jobCommand
  .command("get <jobId>")
  .description("Get job details")
  .action(async (jobId: string) => {
    await job.handleJobGet(jobId);
  });

jobCommand
  .command("download <jobId>")
  .description("Download job results")
  .option("--output <dir>", "Output directory for results", "./results")
  .action(async (jobId: string, options) => {
    await job.handleJobDownload(jobId, { output: options.output });
  });

// File commands
const fileCommand = program.command("file").description("File management");

fileCommand
  .command("list")
  .description("List files")
  .option("--limit <num>", "Number of files to display", "10")
  .action(async (options) => {
    await file.handleFileList({ limit: parseInt(options.limit) });
  });

fileCommand
  .command("get <fileName>")
  .description("Get file details")
  .action(async (fileName: string) => {
    await file.handleFileGet(fileName);
  });

program.parse();
