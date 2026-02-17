import { Engine } from './engine.js';
import { CodeOptimizerWorkflow } from './workflows/code-optimizer.js';
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
const engine = new Engine();
// Register workflows
engine.registerWorkflow(EmailWorkflow);
engine.registerWorkflow(new CodeOptimizerWorkflow());
// Add some dummy tasks
engine.addTask('send-email', { to: 'bob@example.com', subject: 'Meeting' });
engine.addTask('code-optimizer', {
    repoUrl: 'https://github.com/nndr229/todoAppHooks.git',
    repoName: 'todoAppHooks'
});
// Start the engine
engine.start();
// Keep running for demo purposes
setTimeout(() => {
    console.log('[Main] Demo finished, stopping engine.');
    engine.stop();
}, 20000); // 20s run
