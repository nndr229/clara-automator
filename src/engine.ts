import type { Task, TaskStatus, IWorkflow, WorkflowResult } from './types.js';
import { v4 as uuidv4 } from 'uuid';

export class Engine {
  private queue: Task[] = [];
  private workflows: Map<string, IWorkflow> = new Map();
  private isRunning: boolean = false;
  private pollIntervalMs: number = 1000;

  constructor() {}

  registerWorkflow(workflow: IWorkflow) {
    this.workflows.set(workflow.name, workflow);
    console.log(`[Engine] Registered workflow: ${workflow.name}`);
  }

  addTask(type: string, payload: any, maxRetries: number = 3) {
    const task: Task = {
      id: crypto.randomUUID(),
      type,
      payload,
      status: 'PENDING',
      retryCount: 0,
      maxRetries,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.queue.push(task);
    console.log(`[Engine] Added task ${task.id} of type ${type}`);
    return task.id;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[Engine] Started.');
    this.loop();
  }

  stop() {
    this.isRunning = false;
    console.log('[Engine] Stopped.');
  }

  private async loop() {
    while (this.isRunning) {
      const now = new Date();
      
      // Find eligible tasks
      const eligibleTasks = this.queue.filter(t => 
        (t.status === 'PENDING' || t.status === 'RETRYING') &&
        (!t.nextRetryAt || t.nextRetryAt <= now)
      );

      for (const task of eligibleTasks) {
        await this.processTask(task);
      }

      // Wait before next tick to avoid busy loop
      await new Promise(resolve => setTimeout(resolve, this.pollIntervalMs));
    }
  }

  private async processTask(task: Task) {
    const workflow = this.workflows.get(task.type);
    if (!workflow) {
      console.error(`[Engine] No workflow found for type: ${task.type}`);
      task.status = 'FAILED';
      task.error = 'Workflow not registered';
      task.updatedAt = new Date();
      return;
    }

    console.log(`[Engine] Processing task ${task.id} (${task.type})...`);
    task.status = 'RUNNING';
    task.updatedAt = new Date();

    try {
      const result = await workflow.execute(task);

      if (result.success) {
        console.log(`[Engine] Task ${task.id} COMPLETED.`);
        task.status = 'COMPLETED';
        task.updatedAt = new Date();
      } else {
        this.handleFailure(task, result.error || 'Unknown error', result.canRetry ?? true);
      }
    } catch (error: any) {
      this.handleFailure(task, error.message, true);
    }
  }

  private handleFailure(task: Task, errorMsg: string, canRetry: boolean) {
    console.warn(`[Engine] Task ${task.id} failed: ${errorMsg}`);
    task.error = errorMsg;
    task.updatedAt = new Date();

    if (canRetry && task.retryCount < task.maxRetries) {
      task.retryCount++;
      task.status = 'RETRYING';
      
      // Exponential backoff: 2s, 4s, 8s...
      const delaySeconds = Math.pow(2, task.retryCount); 
      task.nextRetryAt = new Date(Date.now() + delaySeconds * 1000);
      
      console.log(`[Engine] Scheduling retry ${task.retryCount}/${task.maxRetries} for ${task.id} in ${delaySeconds}s`);
    } else {
      task.status = 'FAILED';
      console.error(`[Engine] Task ${task.id} FAILED permanently.`);
    }
  }
}
