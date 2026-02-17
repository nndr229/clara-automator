import { Engine } from './engine.js';
import { IWorkflow, Task, WorkflowResult } from './types.js';
import { CodeOptimizerWorkflow } from './workflows/code-optimizer.js';

// Example Workflow: Email Scheduler
const EmailWorkflow: IWorkflow = {
  name: 'send-email',
  async execute(task: Task): Promise<WorkflowResult> {
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
  repoUrl: 'https://github.com/nndr229/DoodlePredictor.git', 
  repoName: 'DoodlePredictor' 
});

// Start the engine
engine.start();

// Keep running for demo purposes
setTimeout(() => {
  console.log('[Main] Demo finished, stopping engine.');
  engine.stop();
}, 20000); // 20s run
