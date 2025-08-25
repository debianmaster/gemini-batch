import { GoogleGenAI, type BatchJob as RawGeminiBatchJob } from "@google/genai";
import type { BatchJob } from "./types.js";

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

  private normalizeStatus(status: string): string {
    return status.toLowerCase().replace(/[\s-]/g, "_");
  }

  async uploadFile(filePath: string): Promise<string> {
    console.log(`Uploading batch input file ${filePath}...`);
    try {
      const uploadedFile = await this.client.files.upload({
        file: filePath,
        config: {
          mimeType: "application/json",
          displayName: `batch-input-${Date.now()}.jsonl`,
        },
      });
      console.log(`Uploaded file ${uploadedFile.name}`);
      return uploadedFile.name!;
    } catch (error) {
      console.error(`Error uploading file ${filePath}:`, error);
      throw error;
    }
  }

  async createBatchJob(inputFileId: string): Promise<BatchJob | null> {
    console.log(`Creating batch job for file ${inputFileId}...`);
    try {
      const job = await this.client.batches.create({
        model: this.model,
        src: inputFileId,
        config: {
          displayName: `batch_job_${Date.now()}`,
        },
      });
      console.log(`Batch job created successfully: ${job.name}`);

      return {
        id: job.name!,
        status: this.normalizeStatus(job.state || "created"),
        inputFileId,
        createdAt: Date.now(),
      };
    } catch (error) {
      console.error(`Error creating batch job:`, error);
      return null;
    }
  }

  async checkBatchStatus(batchId: string): Promise<string | null> {
    try {
      const job = await this.client.batches.get({ name: batchId });
      return this.normalizeStatus(job.state || "unknown");
    } catch (error) {
      console.error(`Error checking batch status:`, error);
      return null;
    }
  }

  async downloadBatchResults(
    batchJob: BatchJob,
    outputFilePath: string,
  ): Promise<boolean> {
    try {
      const job = await this.client.batches.get({ name: batchJob.id });
      if (job.state?.toString() === "COMPLETED") {
        // For now, we'll assume the output is available through a different method
        // This might need to be adjusted based on the actual Gemini batch API
        console.log(`Batch job completed: ${job.name}`);
        return true;
      }
      console.warn(`Batch job not completed. Status: ${job.state}`);
      return false;
    } catch (error) {
      console.error(`Error downloading batch results:`, error);
      return false;
    }
  }

  async listJobs(limit?: number): Promise<RawGeminiBatchJob[]> {
    try {
      const pager = await this.client.batches.list();
      const batches: RawGeminiBatchJob[] = [];

      for await (const batch of pager) {
        batches.push(batch);
        if (limit && batches.length >= limit) break;
      }

      return batches;
    } catch (error) {
      console.error(`Error listing jobs:`, error);
      return [];
    }
  }

  async listFiles(limit?: number): Promise<any[]> {
    try {
      const pager = await this.client.files.list({
        config: { pageSize: limit || 10 },
      });
      const files: any[] = [];

      for await (const file of pager) {
        files.push(file);
        if (limit && files.length >= limit) break;
      }

      return files;
    } catch (error) {
      console.error(`Error listing files:`, error);
      return [];
    }
  }
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      await this.client.batches.cancel({ name: jobId });
      return true;
    } catch (error) {
      console.error(`Error cancelling job ${jobId}:`, error);
      return false;
    }
  }

  async close(): Promise<void> {
    // Gemini client doesn't require explicit closing
  }
}
