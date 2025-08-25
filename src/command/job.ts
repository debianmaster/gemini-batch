import { resolve } from "node:path";
import Table from "cli-table3";
import { config } from "../config.js";
import { BatchProcessor } from "../processor.js";
import { formatDate, logger } from "../utils.js";

// Job command handlers
export async function handleJobList(options: { limit: number }): Promise<void> {
  await config.load();
  const processor = new BatchProcessor();

  try {
    logger.createSpinner("Fetching jobs from Gemini...");
    logger.startSpinner();

    const jobs = await processor.listJobs(options.limit);
    logger.stopSpinner();

    if (jobs.length === 0) {
      logger.warn("No jobs found");
      return;
    }

    const table = new Table({
      head: ["Job Name", "Display Name", "Status", "Created", "Dest"],
      style: {
        head: [],
        border: [],
      },
    });

    for (const job of jobs) {
      table.push([
        job.name,
        job.displayName,
        job.state?.replace("JOB_STATE_", "") ?? "-",
        job.createTime ? formatDate(job.createTime) : "-",
        job.dest?.fileName ?? "-",
      ]);
    }

    logger.log(table.toString());
  } catch (error) {
    logger.error(
      `Failed to fetch jobs: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    await processor.close();
  }
}

export async function handleJobCancel(jobId: string): Promise<void> {
  await config.load();
  const processor = new BatchProcessor();

  try {
    logger.createSpinner(`Cancelling job ${jobId}...`);
    logger.startSpinner();

    const success = await processor.cancelJob(jobId);
    logger.stopSpinner();

    if (success) {
      logger.success(`Job ${jobId} cancelled successfully`);
    } else {
      logger.error(`Failed to cancel job ${jobId}`);
      process.exit(1);
    }
  } catch (error) {
    logger.stopSpinner();
    logger.error(
      `Error cancelling job: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  } finally {
    await processor.close();
  }
}

export async function handleJobSubmit(
  inputs: string[],
  options: {
    output: string;
    maxConcurrent: number;
    checkInterval: number;
  },
): Promise<void> {
  if (inputs.length === 0) {
    logger.error("Please provide at least one input file or directory");
    logger.info("");
    logger.info("Example:");
    logger.info("  gemini-batch job submit sample.jsonl");
    logger.info(
      "  gemini-batch job submit input1.jsonl input2.jsonl --output ./results",
    );
    process.exit(1);
  }

  const outputDir = resolve(options.output);
  const resolvedInputs = inputs.map((input: string) => resolve(input));

  await config.load();

  const apiKey = config.getApiKey();
  if (!apiKey) {
    logger.error(
      `Gemini API key not found. Please set it using 'gemini-batch config set-key YOUR_API_KEY' or set GEMINI_API_KEY environment variable.`,
    );
    process.exit(1);
  }

  if (options.maxConcurrent !== undefined) {
    config.maxConcurrentJobs = options.maxConcurrent;
  }
  if (options.checkInterval !== undefined) {
    config.checkInterval = options.checkInterval;
  }
  await config.save();

  const processor = new BatchProcessor();

  try {
    logger.createSpinner(`Processing batch jobs with Gemini...`);
    logger.startSpinner();

    const results = await processor.processInputs(
      resolvedInputs,
      outputDir,
      options.maxConcurrent,
    );

    logger.stopSpinner();

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    logger.success(`Processing completed!`);
    logger.info(`Total jobs: ${results.length}`);
    logger.info(`Successful: ${successful}`);
    if (failed > 0) {
      logger.warn(`Failed: ${failed}`);
    }
    if (successful > 0) {
      logger.info(`Results saved to: ${outputDir}`);
    }
  } catch (error) {
    logger.stopSpinner();
    logger.error(
      `Processing failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  } finally {
    await processor.close();
  }
}
