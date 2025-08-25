export interface BatchJob {
  id: string;
  status: string;
  inputFileId?: string;
  outputFileId?: string;
  createdAt?: number;
  completedAt?: number;
}

export interface BatchJobResult {
  jobId: string;
  success: boolean;
  outputFilePath?: string;
}
