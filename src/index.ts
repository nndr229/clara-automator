import { Engine } from './engine.js';
import type { IWorkflow, Task } from './types.js';

// Example Workflow: Email Scheduler
const EmailWorkflow: IWorkflow = {
  name: 'send-email',
  async execute(task: Task) {
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
