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

  async submitJob(input: string): Promise<BatchJob> {
    const provider = this.getProvider();
    let fileId: string;

    // Check if input is a file ID (starts with 'files/' pattern) or a local file path
    if (input.startsWith("files/")) {
      // Input is a file ID, validate it exists
      logger.info(`Using existing file ID: ${input}`);
      const file = await provider.getFile(input);
      if (!file) {
        throw new Error(`File not found with ID: ${input}`);
      }
      if (file.state !== "ACTIVE") {
        throw new Error(`File ${input} is not active. State: ${file.state}`);
      }
      fileId = input;
    } else {
      // Input is a local file path, upload it
      const stat = await fs.stat(input);
      if (!stat.isFile()) {
        throw new Error(`Input path is not a file: ${input}`);
      }

      if (extname(input).toLowerCase() !== ".jsonl") {
        throw new Error(`Input file must be a JSONL file: ${input}`);
      }

      // Upload file
      fileId = await provider.uploadFile(input);
    }

    // Create batch job
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

  async getFile(fileId: string) {
    const provider = this.getProvider();
    return await provider.getFile(fileId);
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
