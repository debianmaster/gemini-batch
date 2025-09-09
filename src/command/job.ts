import { dirname, resolve } from "node:path";
import type { BatchJob } from "@google/genai";
import Table from "cli-table3";
import { BatchProcessor } from "../processor.js";
import { formatDate, logger } from "../utils.js";

// Job command handlers
export async function handleJobList(options: {
  limit: number;
}): Promise<BatchJob[]> {
  const processor = new BatchProcessor();

  try {
    logger.createSpinner("Fetching jobs from Gemini...");
    logger.startSpinner();

    const jobs = await processor.listJobs(options.limit);
    logger.stopSpinner();

    if (jobs.length === 0) {
      logger.warn("No jobs found");
      return [];
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

    return jobs;
  } catch (error) {
    logger.error(
      `Failed to fetch jobs: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  } finally {
    await processor.close();
  }
}

export async function handleJobGet(
  jobId: string,
  options?: { json?: boolean },
): Promise<BatchJob | null> {
  const processor = new BatchProcessor();

  try {
    logger.createSpinner(`Fetching job ${jobId}...`);
    logger.startSpinner();

    const job = await processor.getJob(jobId);
    logger.stopSpinner();

    if (!job) {
      if (options?.json) {
        console.log(JSON.stringify({ error: `Job ${jobId} not found` }));
      } else {
        logger.error(`Job ${jobId} not found`);
      }
      return null;
    }

    if (options?.json) {
      console.log(
        JSON.stringify({
          name: job.name,
          displayName: job.displayName,
          state: job.state,
          model: job.model,
          createTime: job.createTime,
          endTime: job.endTime,
          destFileName: job.dest?.fileName,
        }),
      );
    } else {
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
        logger.warn("Job was cancelled");
      } else if (
        job.state === "JOB_STATE_RUNNING" ||
        job.state === "JOB_STATE_QUEUED" ||
        job.state === "JOB_STATE_PENDING"
      ) {
        logger.info("Job is currently running or queued");
      }
    }

    return job;
  } catch (error) {
    logger.stopSpinner();
    if (options?.json) {
      console.log(
        JSON.stringify({
          error: `Failed to get job details: ${error instanceof Error ? error.message : String(error)}`,
        }),
      );
    } else {
      logger.error(
        `Failed to get job details: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return null;
  } finally {
    await processor.close();
  }
}

export async function handleJobDownload(
  jobId: string,
  options: { output?: string; json?: boolean },
): Promise<null | string> {
  const processor = new BatchProcessor();

  try {
    logger.createSpinner(`Checking job ${jobId} status...`);
    logger.startSpinner();

    const job = await processor.getJob(jobId);
    if (!job) {
      logger.stopSpinner();
      if (options.json) {
        console.log(JSON.stringify({ error: `Job ${jobId} not found` }));
      } else {
        logger.error(`Job ${jobId} not found`);
      }
      return null;
    }

    if (job.state !== "JOB_STATE_SUCCEEDED") {
      logger.stopSpinner();
      if (options.json) {
        console.log(
          JSON.stringify({
            error: `Job ${jobId} is not completed. Current status: ${job.state?.replace("JOB_STATE_", "") || "unknown"}`,
            currentState: job.state,
          }),
        );
      } else {
        logger.error(
          `Job ${jobId} is not completed. Current status: ${job.state?.replace("JOB_STATE_", "") || "unknown"}`,
        );
        logger.info("Only completed jobs can be downloaded");
      }
      return null;
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
        if (outputPath.endsWith(".jsonl") || outputPath.includes(".")) {
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
      if (options.json) {
        console.log(
          JSON.stringify({
            success: true,
            outputFile: outputFile,
            jobId: jobId,
          }),
        );
      } else {
        logger.success(`Result downloaded successfully to ${outputFile}`);
      }
      return outputFile;
    } else {
      if (options.json) {
        console.log(
          JSON.stringify({
            error: `Failed to download result for job ${jobId}`,
          }),
        );
      } else {
        logger.error(`Failed to download result for job ${jobId}`);
      }
      return null;
    }
  } catch (error) {
    logger.stopSpinner();
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (options.json) {
      console.log(
        JSON.stringify({
          error: `Error downloading job results: ${errorMessage}`,
        }),
      );
    } else {
      logger.error(`Error downloading job results: ${errorMessage}`);
    }
    return null;
  } finally {
    await processor.close();
  }
}

export async function handleJobCancel(jobId: string): Promise<boolean> {
  const processor = new BatchProcessor();

  try {
    logger.createSpinner(`Cancelling job ${jobId}...`);
    logger.startSpinner();

    const success = await processor.cancelJob(jobId);
    logger.stopSpinner();

    if (success) {
      logger.success(`Job ${jobId} cancelled successfully`);
      return true;
    } else {
      logger.error(`Failed to cancel job ${jobId}`);
      return false;
    }
  } catch (error) {
    logger.stopSpinner();
    logger.error(
      `Error cancelling job: ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  } finally {
    await processor.close();
  }
}

export async function handleJobSubmit(
  input: string,
  options?: { json?: boolean },
): Promise<BatchJob | null> {
  if (!input) {
    if (options?.json) {
      console.log(
        JSON.stringify({
          error: "Please provide an input JSONL file or file ID",
        }),
      );
    } else {
      logger.error("Please provide an input JSONL file or file ID");
      logger.info("");
      logger.info("Examples:");
      logger.info(
        "  gemini-batch job submit sample.jsonl                    # Local file",
      );
      logger.info(
        "  gemini-batch job submit files/xyz123                   # Existing file ID",
      );
      logger.info("");
      logger.info("Use 'gemini-batch file list' to see uploaded files");
    }
    return null;
  }

  const processor = new BatchProcessor();

  try {
    logger.createSpinner(`Submitting batch job to Gemini...`);
    logger.startSpinner();

    const batchJob = await processor.submitJob(input);

    logger.stopSpinner();

    if (options?.json) {
      console.log(
        JSON.stringify({
          success: true,
          job: {
            name: batchJob.name,
            displayName: batchJob.displayName,
            state: batchJob.state,
            createTime: batchJob.createTime,
            model: batchJob.model,
          },
        }),
      );
    } else {
      logger.success(`Job submitted successfully!`);
      logger.info(
        `Use 'gemini-batch job get ${batchJob.name}' to check status`,
      );
      logger.info(
        `Use 'gemini-batch job download ${batchJob.name}' to download result when completed`,
      );
    }

    return batchJob;
  } catch (error) {
    logger.stopSpinner();

    const errorMessage = error instanceof Error ? error.message : String(error);

    if (options?.json) {
      console.log(
        JSON.stringify({
          error: `Job submission failed: ${errorMessage}`,
        }),
      );
    } else {
      logger.error(`Job submission failed: ${errorMessage}`);

      // Provide helpful hints based on the error
      if (errorMessage.includes("File not found with ID")) {
        logger.info("Tip: Use 'gemini-batch file list' to see available files");
      } else if (
        errorMessage.includes("not a file") ||
        errorMessage.includes("JSONL")
      ) {
        logger.info(
          "Tip: Make sure the file path is correct and the file is in JSONL format",
        );
      }
    }

    return null;
  } finally {
    await processor.close();
  }
}
