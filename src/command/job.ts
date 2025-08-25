import { resolve, dirname } from "node:path";
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

    // Generate default filename
    const defaultFilename = `${Math.floor(Date.now() / 1000)}_${jobId.split("/").pop()}.jsonl`;

    // Determine output file path
    let outputFile: string;
    if (options.output) {
      const fs = await import("fs/promises");
      const outputPath = resolve(options.output);

      try {
        const stat = await fs.stat(outputPath);
        if (stat.isDirectory()) {
          // Output is an existing directory
          outputFile = resolve(outputPath, defaultFilename);
        } else {
          // Output is an existing file, use as is
          outputFile = outputPath;
        }
      } catch {
        // Path doesn't exist, determine based on extension
        if (outputPath.endsWith('.jsonl') || outputPath.includes('.')) {
          // Looks like a file path
          outputFile = outputPath;
        } else {
          // Looks like a directory path
          outputFile = resolve(outputPath, defaultFilename);
        }
      }
    } else {
      // No output specified, use current directory with default filename
      outputFile = resolve(defaultFilename);
    }

    // Ensure output directory exists
    const fs = await import("fs/promises");
    await fs.mkdir(dirname(outputFile), { recursive: true });

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
    logger.error("Please provide an input JSONL file or file ID");
    logger.info("");
    logger.info("Examples:");
    logger.info("  gemini-batch job submit sample.jsonl                    # Local file");
    logger.info("  gemini-batch job submit files/xyz123                   # Existing file ID");
    logger.info("");
    logger.info("Use 'gemini-batch file list' to see uploaded files");
    process.exit(1);
  }

  const processor = new BatchProcessor();

  try {
    logger.createSpinner(`Submitting batch job to Gemini...`);
    logger.startSpinner();

    const batchJob = await processor.submitJob(input);

    logger.stopSpinner();

    logger.success(`Job submitted successfully!`);
    logger.info(`Use 'gemini-batch job get ${batchJob.name}' to check status`);
    logger.info(
      `Use 'gemini-batch job download ${batchJob.name}' to download result when completed`,
    );
  } catch (error) {
    logger.stopSpinner();
    logger.error(
      `Job submission failed: ${error instanceof Error ? error.message : String(error)}`,
    );

    // Provide helpful hints based on the error
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("File not found with ID")) {
      logger.info("Tip: Use 'gemini-batch file list' to see available files");
    } else if (errorMessage.includes("not a file") || errorMessage.includes("JSONL")) {
      logger.info("Tip: Make sure the file path is correct and the file is in JSONL format");
    }

    process.exit(1);
  } finally {
    await processor.close();
  }
}
