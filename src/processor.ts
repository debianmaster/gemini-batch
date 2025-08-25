import { promises as fs } from "fs";
import { extname, join } from "path";
import { config } from "./config.js";
import { GeminiProvider } from "./gemini.js";
import type { BatchJob, BatchJobResult } from "./types.js";
import { logger } from "./utils.js";

export class BatchProcessor {
  private provider: GeminiProvider | null = null;

  constructor() {
    this.initializeProvider();
  }

  private initializeProvider(): void {
    const apiKey = config.getApiKey();
    if (apiKey) {
      try {
        const model = config.getModel();
        this.provider = new GeminiProvider(apiKey, model);
      } catch (error) {
        logger.warn(`Failed to initialize Gemini provider: ${error}`);
      }
    }
  }

  getProvider(): GeminiProvider {
    if (!this.provider) {
      throw new Error(
        `Gemini provider is not initialized. Please check your API key configuration.`,
      );
    }
    return this.provider;
  }

  async uploadFile(filePath: string): Promise<string> {
    const provider = this.getProvider();
    return await provider.uploadFile(filePath);
  }

  async createBatchJob(inputFileId: string): Promise<BatchJob | null> {
    const provider = this.getProvider();
    return await provider.createBatchJob(inputFileId);
  }

  async checkBatchStatus(batchId: string): Promise<string | null> {
    const provider = this.getProvider();
    return await provider.checkBatchStatus(batchId);
  }

  async downloadBatchResults(
    batchJob: BatchJob,
    outputFilePath: string,
  ): Promise<boolean> {
    const provider = this.getProvider();
    return await provider.downloadBatchResults(batchJob, outputFilePath);
  }

  async processFile(
    inputFilePath: string,
    outputDir: string,
  ): Promise<BatchJobResult> {
    try {
      // Upload file
      const fileId = await this.uploadFile(inputFilePath);

      // Create batch job
      const batchJob = await this.createBatchJob(fileId);
      if (!batchJob) {
        return {
          jobId: "unknown",
          success: false,
        };
      }

      // Monitor job status
      const result = await this.monitorBatchJob(batchJob, outputDir);
      return result;
    } catch (error) {
      logger.error(`Error processing file ${inputFilePath}: ${error}`);
      return {
        jobId: "unknown",
        success: false,
      };
    }
  }

  private async monitorBatchJob(
    batchJob: BatchJob,
    outputDir: string,
  ): Promise<BatchJobResult> {
    let checkInterval = config.getConfig().checkInterval * 1000; // Convert to milliseconds
    const maxInterval = 60000; // 60 seconds max

    while (true) {
      const status = await this.checkBatchStatus(batchJob.id);

      if (status === "completed") {
        const outputFile = join(outputDir, `${batchJob.id}_results.jsonl`);
        const success = await this.downloadBatchResults(batchJob, outputFile);

        return {
          jobId: batchJob.id,
          success,
          ...(success && { outputFilePath: outputFile }),
        };
      } else if (
        status &&
        ["failed", "expired", "cancelled", "error"].includes(status)
      ) {
        logger.error(`Batch job ${batchJob.id} ${status}`);
        return {
          jobId: batchJob.id,
          success: false,
        };
      } else if (!status) {
        logger.error(`Failed to retrieve status for batch job ${batchJob.id}`);
        return {
          jobId: batchJob.id,
          success: false,
        };
      }

      // Wait before next check with exponential backoff
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
      checkInterval = Math.min(checkInterval * 1.5, maxInterval);
    }
  }

  async processInputs(
    inputPaths: string[],
    outputDir: string,
    maxConcurrentJobs?: number,
  ): Promise<BatchJobResult[]> {
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Find all JSONL files
    const inputFiles: string[] = [];
    for (const path of inputPaths) {
      const stat = await fs.stat(path);
      if (stat.isDirectory()) {
        const files = await fs.readdir(path);
        for (const file of files) {
          if (extname(file).toLowerCase() === ".jsonl") {
            inputFiles.push(join(path, file));
          }
        }
      } else if (extname(path).toLowerCase() === ".jsonl") {
        inputFiles.push(path);
      } else {
        logger.warn(`Skipping non-JSONL file: ${path}`);
      }
    }

    if (inputFiles.length === 0) {
      logger.warn("No JSONL files found in the provided paths");
      return [];
    }

    // Process files with concurrency limit
    const concurrency = maxConcurrentJobs || config.maxConcurrentJobs;
    const results: BatchJobResult[] = [];

    for (let i = 0; i < inputFiles.length; i += concurrency) {
      const batch = inputFiles.slice(i, i + concurrency);
      const batchPromises = batch.map((file) =>
        this.processFile(file, outputDir),
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  async listJobs(limit?: number) {
    const provider = this.getProvider();
    return await provider.listJobs(limit);
  }

  async listFiles(limit?: number): Promise<any[]> {
    const provider = this.getProvider();
    return await provider.listFiles(limit);
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const provider = this.getProvider();
    return await provider.cancelJob(jobId);
  }

  async close(): Promise<void> {
    if (this.provider) {
      await this.provider.close();
      this.provider = null;
    }
  }
}
