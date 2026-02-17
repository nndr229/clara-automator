"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Engine = void 0;
const types_1 = require("./types");
const uuid_1 = require("uuid"); // Need to install uuid
class Engine {
    queue = [];
    workflows = new Map();
    isRunning = false;
    pollIntervalMs = 1000;
    constructor() { }
    registerWorkflow(workflow) {
        this.workflows.set(workflow.name, workflow);
        console.log(`[Engine] Registered workflow: ${workflow.name}`);
    }
    addTask(type, payload, maxRetries = 3) {
        const task = {
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
        if (this.isRunning)
            return;
        this.isRunning = true;
        console.log('[Engine] Started.');
        this.loop();
    }
    stop() {
        this.isRunning = false;
        console.log('[Engine] Stopped.');
    }
    async loop() {
        while (this.isRunning) {
            const now = new Date();
            // Find eligible tasks
            const eligibleTasks = this.queue.filter(t => (t.status === 'PENDING' || t.status === 'RETRYING') &&
                (!t.nextRetryAt || t.nextRetryAt <= now));
            for (const task of eligibleTasks) {
                await this.processTask(task);
            }
            // Wait before next tick to avoid busy loop
            await new Promise(resolve => setTimeout(resolve, this.pollIntervalMs));
        }
    }
    async processTask(task) {
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
            }
            else {
                this.handleFailure(task, result.error || 'Unknown error', result.canRetry ?? true);
            }
        }
        catch (error) {
            this.handleFailure(task, error.message, true);
        }
    }
    handleFailure(task, errorMsg, canRetry) {
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
        }
        else {
            task.status = 'FAILED';
            console.error(`[Engine] Task ${task.id} FAILED permanently.`);
        }
    }
}
exports.Engine = Engine;
//# sourceMappingURL=engine.js.map