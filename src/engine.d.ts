import { IWorkflow } from './types';
export declare class Engine {
    private queue;
    private workflows;
    private isRunning;
    private pollIntervalMs;
    constructor();
    registerWorkflow(workflow: IWorkflow): void;
    addTask(type: string, payload: any, maxRetries?: number): string;
    start(): void;
    stop(): void;
    private loop;
    private processTask;
    private handleFailure;
}
//# sourceMappingURL=engine.d.ts.map