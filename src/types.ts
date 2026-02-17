export type TaskStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'RETRYING';

export interface Task {
  id: string;
  type: string;
  payload: any;
  status: TaskStatus;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
  error?: string;
  nextRetryAt?: Date;
}

export interface WorkflowResult {
  success: boolean;
  data?: any;
  error?: string;
  canRetry?: boolean;
}

export interface IWorkflow {
  name: string;
  execute(task: Task): Promise<WorkflowResult>;
}
