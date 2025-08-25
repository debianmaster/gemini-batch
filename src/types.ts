export interface BatchJob {
  id: string;
  status: string;
  inputFileId?: string;
  outputFileId?: string;
  createdAt?: number;
  completedAt?: number;
}
