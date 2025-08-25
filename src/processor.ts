import { promises as fs } from "node:fs";
import { extname } from "node:path";
import type { BatchJob } from "@google/genai";
import { config } from "./config.js";
import { GeminiProvider } from "./gemini.js";
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

  async submitJob(inputPath: string): Promise<BatchJob> {
    // Check if input is a valid JSONL file
    const stat = await fs.stat(inputPath);
    if (!stat.isFile()) {
      throw new Error(`Input path is not a file: ${inputPath}`);
    }

    if (extname(inputPath).toLowerCase() !== ".jsonl") {
      throw new Error(`Input file must be a JSONL file: ${inputPath}`);
    }

    const provider = this.getProvider();

    // Upload file and create batch job
    const fileId = await provider.uploadFile(inputPath);
    const batchJob = await provider.createBatchJob(fileId);

    if (!batchJob) {
      throw new Error("Failed to create batch job");
    }

    return batchJob;
  }

  async listJobs(limit?: number) {
    const provider = this.getProvider();
    return await provider.listJobs(limit);
  }

  async listFiles(limit?: number) {
    const provider = this.getProvider();
    return await provider.listFiles(limit);
  }

  async getJob(jobId: string) {
    const provider = this.getProvider();
    return await provider.getJob(jobId);
  }

  async downloadJobResults(
    jobId: string,
    outputFilePath: string,
  ): Promise<boolean> {
    const provider = this.getProvider();
    return await provider.downloadJobResults(jobId, outputFilePath);
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
