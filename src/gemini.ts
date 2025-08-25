import { type BatchJob, GoogleGenAI, type File } from "@google/genai";
import { logger } from "./utils.js";

export class GeminiProvider {
  private client: GoogleGenAI;
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = "gemini-2.0-flash-exp") {
    this.apiKey = apiKey;
    this.model = model;
    this.client = new GoogleGenAI({
      apiKey: this.apiKey,
    });
  }

  async uploadFile(filePath: string): Promise<string> {
    logger.info(`Uploading batch input file ${filePath}...`);
    try {
      const uploadedFile = await this.client.files.upload({
        file: filePath,
        config: {
          mimeType: "application/json",
          displayName: `batch-input-${Date.now()}.jsonl`,
        },
      });
      logger.success(`Uploaded file ${uploadedFile.name}`);
      return uploadedFile.name!;
    } catch (error) {
      logger.error(`Error uploading file ${filePath}: ${error}`);
      throw error;
    }
  }

  async createBatchJob(inputFileId: string): Promise<BatchJob | null> {
    logger.info(`Creating batch job for file ${inputFileId}...`);
    try {
      const job = await this.client.batches.create({
        model: this.model,
        src: inputFileId,
        config: {
          displayName: `batch_job_${Date.now()}`,
        },
      });
      logger.success(`Batch job created successfully: ${job.name}`);

      return job;
    } catch (error) {
      logger.error(`Error creating batch job: ${error}`);
      return null;
    }
  }

  async listJobs(limit?: number): Promise<BatchJob[]> {
    try {
      const pager = await this.client.batches.list();
      const batches: BatchJob[] = [];

      for await (const batch of pager) {
        batches.push(batch);
        if (limit && batches.length >= limit) break;
      }

      return batches;
    } catch (error) {
      logger.error(`Error listing jobs: ${error}`);
      return [];
    }
  }

  async listFiles(limit?: number): Promise<File[]> {
    try {
      const pager = await this.client.files.list({
        config: { pageSize: limit || 10 },
      });
      const files: File[] = [];

      for await (const file of pager) {
        files.push(file);
        if (limit && files.length >= limit) break;
      }

      return files;
    } catch (error) {
      logger.error(`Error listing files: ${error}`);
      return [];
    }
  }
  async getJob(jobId: string): Promise<BatchJob | null> {
    try {
      const job = await this.client.batches.get({ name: jobId });
      return job;
    } catch (error) {
      logger.error(`Error getting job ${jobId}: ${error}`);
      return null;
    }
  }

  async downloadJobResults(
    jobId: string,
    outputFilePath: string,
  ): Promise<boolean> {
    try {
      const job = await this.client.batches.get({ name: jobId });
      if (job.state?.toString() !== "JOB_STATE_SUCCEEDED") {
        logger.warn(`Job ${jobId} is not completed. Status: ${job.state}`);
        return false;
      }

      if (!job.dest?.fileName) {
        logger.warn(`Job ${jobId} has no output file`);
        return false;
      }

      // Download the result file using the file ID from job.dest.fileName
      await this.client.files.download({
        file: job.dest.fileName,
        downloadPath: outputFilePath,
      });

      logger.success(`Downloaded job results to: ${outputFilePath}`);
      return true;
    } catch (error) {
      logger.error(`Error downloading job results for ${jobId}: ${error}`);
      return false;
    }
  }

  async cancelJob(jobId: string): Promise<boolean> {
    try {
      await this.client.batches.cancel({ name: jobId });
      return true;
    } catch (error) {
      logger.error(`Error cancelling job ${jobId}: ${error}`);
      return false;
    }
  }

  async close(): Promise<void> {
    // Gemini client doesn't require explicit closing
  }
}
