import "dotenv/config";

import { cac } from "cac";
import * as config from "./command/config.js";
import * as file from "./command/file.js";
import * as job from "./command/job.js";
import { logger } from "./utils.js";

const cli = cac("gemini-batch");

type ConfigVerb = "list" | "set-key" | "set-model" | "reset";

// Config commands
cli
  .command("config <verb> [value]", "Configuration management")
  .action(async (verb: ConfigVerb, value?: string) => {
    if (verb === "list") {
      await config.handleConfigList();
    } else if (verb === "set-key") {
      if (!value) {
        logger.error("API key is required for set-key command");
        process.exit(1);
      }
      await config.handleConfigSetKey(value);
    } else if (verb === "set-model") {
      if (!value) {
        logger.error("Model is required for set-model command");
        process.exit(1);
      }
      await config.handleConfigSetModel(value);
    } else if (verb === "reset") {
      await config.handleConfigReset();
    } else {
      logger.error(`Unknown config command: ${verb}`);
      logger.info("Available config commands: list, set-key, set-model, reset");
      process.exit(1);
    }
  });

type JobVerb = "list" | "submit" | "cancel";
// Job commands
cli
  .command("job <verb> [job-id] [...inputs]", "Job management")
  .option("--limit <num>", "Number of jobs to display", {
    default: 20,
    type: [Number],
  })
  .option("--output <dir>", "Output directory for results", {
    default: "./results",
  })
  .option("--max-concurrent <num>", "Maximum concurrent jobs", {
    default: 5,
    type: [Number],
  })
  .option("--check-interval <seconds>", "Status check interval in seconds", {
    default: 5,
    type: [Number],
  })
  .action(
    async (verb: JobVerb, jobId?: string, inputs?: string[], options?) => {
      if (verb === "list") {
        await job.handleJobList({ limit: options.limit });
      } else if (verb === "cancel") {
        if (!jobId) {
          logger.error("Job ID is required for cancel command");
          process.exit(1);
        }
        await job.handleJobCancel(jobId);
      } else if (verb === "submit") {
        const i = inputs ?? [];
        const submitInputs = jobId ? [jobId, ...i] : i;
        await job.handleJobSubmit(submitInputs, {
          output: options.output,
          maxConcurrent: options.maxConcurrent,
          checkInterval: options.checkInterval,
        });
      } else {
        logger.error(`Unknown job command: ${verb}`);
        logger.info("Available job commands: list, cancel, submit");
        process.exit(1);
      }
    },
  );

type FileVerb = "list" | "get";

// File commands
cli
  .command("file <verb> [file-name]", "File management")
  .option("--limit <num>", "Number of files to display", {
    default: 10,
    type: [Number],
  })
  .action(async (verb: FileVerb, fileName?: string, options?) => {
    if (verb === "list") {
      await file.handleFileList({ limit: options.limit });
    } else if (verb === "get") {
      if (!fileName) {
        logger.error("File name is required for get command");
        process.exit(1);
      }
      await file.handleFileGet(fileName);
    } else {
      logger.error(`Unknown file command: ${verb}`);
      logger.info("Available file commands: list, get");
      process.exit(1);
    }
  });

cli.help();
cli.version("1.0.0");

// Handle unknown commands
cli.on("command:*", () => {
  logger.error(`Unknown command: ${cli.args.join(" ")}`);
  logger.log("");
  logger.info("Available commands:");
  logger.log("  config <list|set-key|set-model|reset> [value]");
  logger.log("  job <list|submit|cancel> [job-id] [...inputs]");
  logger.log("  file <list|get> [file-name]");
  logger.log("");
  logger.info("Use 'gemini-batch --help' for more information");
  process.exit(1);
});

cli.parse();
