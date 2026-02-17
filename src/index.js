"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const engine_1 = require("./engine");
const types_1 = require("./types");
// Example Workflow: Email Scheduler
const EmailWorkflow = {
    name: 'send-email',
    async execute(task) {
        // Simulate processing
        console.log(`   -> [EmailWorkflow] Sending email to ${task.payload.to}...`);
        // Simulate random failure
        if (Math.random() > 0.7) {
            return { success: false, error: 'SMTP Connection Timeout', canRetry: true };
        }
        return { success: true };
    }
};
// Main execution
const engine = new engine_1.Engine();
// Register workflows
engine.registerWorkflow(EmailWorkflow);
// Add some dummy tasks
engine.addTask('send-email', { to: 'bob@example.com', subject: 'Meeting' });
engine.addTask('send-email', { to: 'alice@example.com', subject: 'Updates' });
engine.addTask('unknown-task', {}); // Should fail
// Start the engine
engine.start();
// Keep running for demo purposes
setTimeout(() => {
    console.log('[Main] Demo finished, stopping engine.');
    engine.stop();
}, 10000);
//# sourceMappingURL=index.js.map