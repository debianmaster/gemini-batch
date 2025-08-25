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

export async function handleJobGet(jobId: string): Promise<void> {
  await config.load();
  const processor = new BatchProcessor();

  try {
    logger.createSpinner(`Fetching job ${jobId}...`);
    logger.startSpinner();

    const job = await processor.getJob(jobId);
    logger.stopSpinner();

    if (!job) {
      logger.error(`Job ${jobId} not found`);
      process.exit(1);
    }

    // Display job details in a table format
    const table = new Table({
      style: {
        head: [],
        border: [],
      },
    });

    table.push(
      ["Job Name", job.name || "-"],
      ["Display Name", job.displayName || "-"],
      ["Status", job.state?.replace("JOB_STATE_", "") || "-"],
      ["Model", job.model || "-"],
      ["Created Time", job.createTime ? formatDate(job.createTime) : "-"],
      ["Source File", job.src?.fileName || "-"],
      ["Destination File", job.dest?.fileName || "-"],
    );

    logger.log(`\nJob Details:`);
    logger.log(table.toString());

    if (job.state === "JOB_STATE_SUCCEEDED") {
      logger.success("Job completed successfully");
      logger.info(
        "Use 'gemini-batch job download <job-id>' to download the results",
      );
    } else if (job.state === "JOB_STATE_FAILED") {
      logger.error("Job failed");
    } else if (job.state === "JOB_STATE_CANCELLED") {
      logger.warn(" Job was cancelled");
    } else if (
      job.state === "JOB_STATE_RUNNING" ||
      job.state === "JOB_STATE_QUEUED" ||
      job.state === "JOB_STATE_PENDING"
    ) {
      logger.info("Job is currently running or queued");
    }
  } catch (error) {
    logger.stopSpinner();
    logger.error(
      `Failed to get job details: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  } finally {
    await processor.close();
  }
}

export async function handleJobDownload(
  jobId: string,
  options: { output?: string },
): Promise<void> {
  await config.load();
  const processor = new BatchProcessor();

  try {
    logger.createSpinner(`Checking job ${jobId} status...`);
    logger.startSpinner();

    const job = await processor.getJob(jobId);
    if (!job) {
      logger.stopSpinner();
      logger.error(`Job ${jobId} not found`);
      process.exit(1);
    }

    if (job.state !== "JOB_STATE_SUCCEEDED") {
      logger.stopSpinner();
      logger.error(
        `Job ${jobId} is not completed. Current status: ${job.state?.replace("JOB_STATE_", "") || "unknown"}`,
      );
      logger.info("Only completed jobs can be downloaded");
      process.exit(1);
    }

    logger.stopSpinner();
    logger.createSpinner(`Downloading results for job ${jobId}...`);
    logger.startSpinner();

    // Determine output file path
    const outputDir = resolve(options.output || ".");
    const outputFile = resolve(
      outputDir,
      `${jobId.split("/").pop()}_results.jsonl`,
    );

    // Ensure output directory exists
    const fs = await import("fs/promises");
    await fs.mkdir(outputDir, { recursive: true });

    const success = await processor.downloadJobResults(jobId, outputFile);
    logger.stopSpinner();

    if (success) {
      logger.success(`Results downloaded successfully to: ${outputFile}`);
    } else {
      logger.error(`Failed to download results for job ${jobId}`);
      process.exit(1);
    }
  } catch (error) {
    logger.stopSpinner();
    logger.error(
      `Error downloading job results: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
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
