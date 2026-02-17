import { simpleGit } from 'simple-git';
import { ESLint } from 'eslint';
import type { IWorkflow, Task, WorkflowResult } from '../types.js';
import * as path from 'path';
import * as fs from 'fs';
import { pathToFileURL } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface OptimizationPayload {
  repoUrl: string;
  repoName: string;
  branch?: string;
}

export class CodeOptimizerWorkflow implements IWorkflow {
  name = 'code-optimizer';
  private workDir = path.resolve(process.cwd(), 'temp-repos');
  private agentRoot = process.cwd();
  
  // Hardcoded paths for Python tools based on user environment
  private pythonBinPath = '/Users/nithindeepkumar/Library/Python/3.10/bin';
  private blackCmd = path.join(this.pythonBinPath, 'black');
  private pylintCmd = path.join(this.pythonBinPath, 'pylint');

  constructor() {
    if (!fs.existsSync(this.workDir)) {
      fs.mkdirSync(this.workDir, { recursive: true });
    }
  }

  async execute(task: Task): Promise<WorkflowResult> {
    const payload = task.payload as OptimizationPayload;
    const repoPath = path.join(this.workDir, payload.repoName);
    const git = simpleGit();

    let totalScore = 100;
    let totalFindings = 0;
    let fixedFiles = 0;

    try {
      // 1. Clone or Pull
      if (fs.existsSync(repoPath)) {
        console.log(`[Optimizer] Repo exists, pulling latest...`);
        await simpleGit(repoPath).pull();
      } else {
        console.log(`[Optimizer] Cloning ${payload.repoUrl}...`);
        await git.clone(payload.repoUrl, repoPath);
      }

      // === JS/TS Analysis ===
      console.log(`[Optimizer] Scanning for JS/TS files...`);
      const jsScore = await this.analyzeJS(repoPath);
      if (jsScore.filesFound) {
        console.log(`[Optimizer] JS/TS Score: ${jsScore.score}/100`);
        totalScore = Math.min(totalScore, jsScore.score);
        totalFindings += jsScore.findings;
        fixedFiles += jsScore.fixed;
      }

      // === Python Analysis ===
      console.log(`[Optimizer] Scanning for Python files...`);
      const pyScore = await this.analyzePython(repoPath);
      if (pyScore.filesFound) {
        console.log(`[Optimizer] Python Score: ${pyScore.score}/100`);
        totalScore = Math.min(totalScore, pyScore.score); // Use the worst score
        totalFindings += pyScore.findings;
        fixedFiles += pyScore.fixed;
      }

      // === Final Report ===
      if (!jsScore.filesFound && !pyScore.filesFound) {
         console.warn(`[Optimizer] No supported code files found.`);
         return { success: false, error: 'No supported code files found.' };
      }

      // Commit if changes
      if (fixedFiles > 0) {
        const optimizationBranch = `clara-optimize-${Date.now()}`;
        const repoGit = simpleGit(repoPath);
        
        // Clean up injected config if any
        const configPath = path.join(repoPath, 'eslint.config.mjs');
        if (fs.existsSync(configPath)) fs.unlinkSync(configPath);

        await repoGit.checkoutLocalBranch(optimizationBranch);
        await repoGit.add('.');
        await repoGit.commit(`chore: optimize code (Score: ${totalScore}/100)`);
        
        console.log(`[Optimizer] Created branch ${optimizationBranch} with fixes.`);
        // await repoGit.push('origin', optimizationBranch); 
      } else {
        console.log(`[Optimizer] Code is clean. No fixes needed.`);
        const configPath = path.join(repoPath, 'eslint.config.mjs');
        if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
      }

      return { 
        success: true, 
        data: { score: totalScore, findings: totalFindings, fixedFiles } 
      };

    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async analyzeJS(repoPath: string) {
    // Inject Config
    const parserPath = pathToFileURL(path.resolve(this.agentRoot, 'node_modules/@typescript-eslint/parser/dist/index.js')).href;
    const pluginPath = pathToFileURL(path.resolve(this.agentRoot, 'node_modules/@typescript-eslint/eslint-plugin/dist/index.js')).href;
    
    const configContent = `
import parser from '${parserPath}';
import plugin from '${pluginPath}';

export default [
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: parser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        ecmaFeatures: { jsx: true }
      }
    },
    plugins: { "@typescript-eslint": plugin },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn"
    },
    ignores: ["dist/", "node_modules/", "temp-repos/", "build/", "public/", "venv/", ".venv/"]
  }
];`;
    
    const configPath = path.join(repoPath, 'eslint.config.mjs');
    fs.writeFileSync(configPath, configContent);

    const eslint = new ESLint({ cwd: repoPath, fix: true });
    const results = await eslint.lintFiles(['**/*.{js,jsx,ts,tsx}']);
    
    let totalErrors = 0;
    let totalWarnings = 0;
    let fixed = 0;
    let filesFound = results.length > 0;

    for (const result of results) {
      totalErrors += result.errorCount;
      totalWarnings += result.warningCount;
      if (result.output) fixed++;
    }

    if (fixed > 0) await ESLint.outputFixes(results);

    const score = Math.max(0, 100 - (totalErrors * 5) - (totalWarnings * 1));
    return { score, findings: totalErrors + totalWarnings, fixed, filesFound };
  }

  private async analyzePython(repoPath: string) {
    // Check for .py files
    // Find files manually or assume based on black check
    // We'll try running black --check on the dir
    let filesFound = false;
    let score = 100;
    let fixed = 0;
    let findings = 0;

    try {
      // 1. Run Black (Format)
      console.log(`[Optimizer] Running Black formatter...`);
      try {
        await execAsync(`${this.blackCmd} .`, { cwd: repoPath });
        // Black modifies files in place, so if it succeeds, files are formatted.
        // We can't easily know strictly "how many" without parsing output, but we assume success means formatting applied.
        filesFound = true; // If black ran, py files exist
        fixed = 1; // Assume at least one file might have been touched (simplification)
      } catch (e: any) {
        // Black returns exit code 1 if files were modified (in check mode) or 123 on error
        // But in default mode, it returns 0 on success. 
        // If no files found, it might complain.
        if (e.message.includes('No Python files are present')) {
          return { score: 100, findings: 0, fixed: 0, filesFound: false };
        }
      }

      // 2. Run Pylint (Score)
      console.log(`[Optimizer] Running Pylint...`);
      try {
        // Pylint returns a score in its output: "Your code has been rated at X.XX/10"
        const { stdout } = await execAsync(`${this.pylintCmd} --recursive=y .`, { cwd: repoPath });
        // Parse score
        const match = stdout.match(/Your code has been rated at (-?\d+\.?\d*)\/10/);
        if (match) {
          const pylintScore = parseFloat(match[1]);
          score = Math.round(pylintScore * 10); // Scale to 100
        }
      } catch (e: any) {
        // Pylint returns non-zero exit codes for issues
        if (e.stdout) {
           const match = e.stdout.match(/Your code has been rated at (-?\d+\.?\d*)\/10/);
           if (match) {
             const pylintScore = parseFloat(match[1]);
             score = Math.round(pylintScore * 10);
           }
        }
        findings = 1; // Generic finding count if pylint failed
        filesFound = true;
      }
      
    } catch (e) {
      console.warn(`[Optimizer] Python tools failed: ${e}`);
    }

    return { score, findings, fixed, filesFound };
  }
}
