import { resolve } from "node:path";
import Table from "cli-table3";
import { BatchProcessor } from "../processor.js";
import { formatDate, logger } from "../utils.js";

// Job command handlers
export async function handleJobList(options: { limit: number }): Promise<void> {
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
      head: [
        "Job Name",
        "Display Name",
        "Status",
        "Created Time",
        "End Time",
        "Dest",
      ],
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
        job.endTime ? formatDate(job.endTime) : "-",
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
      ["End Time", job.endTime ? formatDate(job.endTime) : "-"],
      ["Destination File", job.dest?.fileName || "-"],
    );

    logger.log(`\nJob Details:`);
    logger.log(table.toString());

    if (job.state === "JOB_STATE_SUCCEEDED") {
      logger.success("Job completed successfully");
      logger.info(
        `Use 'gemini-batch job download ${job.name}' to download the result`,
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
    logger.createSpinner(`Downloading result...`);
    logger.startSpinner();

    // Determine output file path
    const outputDir = resolve(options.output || ".");
    const outputFile = resolve(
      outputDir,
      `${Math.floor(Date.now() / 1000)}_${jobId.split("/").pop()}.jsonl`,
    );

    // Ensure output directory exists
    const fs = await import("fs/promises");
    await fs.mkdir(outputDir, { recursive: true });

    const success = await processor.downloadJobResults(jobId, outputFile);
    logger.stopSpinner();

    if (success) {
      logger.success(`Result downloaded successfully to ${outputFile}`);
    } else {
      logger.error(`Failed to download result for job ${jobId}`);
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

export async function handleJobSubmit(input: string): Promise<void> {
  if (!input) {
    logger.error("Please provide a input JSONL file");
    logger.info("");
    logger.info("Example:");
    logger.info("  gemini-batch job submit sample.jsonl");
    process.exit(1);
  }

  const inputFile = resolve(input);
  const processor = new BatchProcessor();

  try {
    logger.createSpinner(`Submitting batch job to Gemini...`);
    logger.startSpinner();

    const batchJob = await processor.submitJob(inputFile);

    logger.stopSpinner();

    logger.success(`Job submitted successfully!`);
    logger.log(`\n`);
    logger.info(`Use 'gemini-batch job get ${batchJob.name}' to check status`);
    logger.info(
      `Use 'gemini-batch job download ${batchJob.name}' to download result when completed`,
    );
  } catch (error) {
    logger.stopSpinner();
    logger.error(
      `Job submission failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  } finally {
    await processor.close();
  }
}
