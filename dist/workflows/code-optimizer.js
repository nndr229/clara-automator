import { simpleGit } from 'simple-git';
import { ESLint } from 'eslint';
import * as path from 'path';
import * as fs from 'fs';
import { pathToFileURL } from 'url';
export class CodeOptimizerWorkflow {
    name = 'code-optimizer';
    workDir = path.resolve(process.cwd(), 'temp-repos');
    agentRoot = process.cwd(); // Root where node_modules lives
    constructor() {
        if (!fs.existsSync(this.workDir)) {
            fs.mkdirSync(this.workDir, { recursive: true });
        }
    }
    async execute(task) {
        const payload = task.payload;
        const repoPath = path.join(this.workDir, payload.repoName);
        const git = simpleGit();
        try {
            // 1. Clone or Pull
            if (fs.existsSync(repoPath)) {
                console.log(`[Optimizer] Repo exists, pulling latest...`);
                await simpleGit(repoPath).pull();
            }
            else {
                console.log(`[Optimizer] Cloning ${payload.repoUrl}...`);
                await git.clone(payload.repoUrl, repoPath);
            }
            // 2. Inject Config (eslint.config.mjs)
            // We import dependencies from the AGENT'S node_modules using absolute file URLs.
            // This allows us to lint the target repo without npm install inside it.
            const parserPath = pathToFileURL(path.resolve(this.agentRoot, 'node_modules/@typescript-eslint/parser/dist/index.js')).href;
            const pluginPath = pathToFileURL(path.resolve(this.agentRoot, 'node_modules/@typescript-eslint/eslint-plugin/dist/index.js')).href;
            const configContent = `
import parser from '${parserPath}';
import plugin from '${pluginPath}';

export default [
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: parser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module"
      }
    },
    plugins: {
      "@typescript-eslint": plugin
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/no-explicit-any": "warn"
    },
    ignores: ["dist/", "node_modules/", "temp-repos/"]
  }
];
`;
            const configPath = path.join(repoPath, 'eslint.config.mjs');
            fs.writeFileSync(configPath, configContent);
            // 3. Analyze Code
            // ESLint 9 automatically picks up eslint.config.mjs in cwd
            const eslint = new ESLint({
                cwd: repoPath,
                fix: true
            });
            console.log(`[Optimizer] Analyzing code in ${repoPath} using injected config...`);
            const results = await eslint.lintFiles(['**/*.ts']);
            // Calculate Score
            let totalErrors = 0;
            let totalWarnings = 0;
            let fixedCount = 0;
            for (const result of results) {
                totalErrors += result.errorCount;
                totalWarnings += result.warningCount;
                if (result.output)
                    fixedCount++; // File was modified
            }
            const score = Math.max(0, 100 - (totalErrors * 5) - (totalWarnings * 1));
            console.log(`[Optimizer] Score: ${score}/100 (Errors: ${totalErrors}, Warnings: ${totalWarnings})`);
            // 4. Apply Fixes
            if (fixedCount > 0) {
                console.log(`[Optimizer] Applying auto-fixes to ${fixedCount} files...`);
                await ESLint.outputFixes(results);
                // 5. Commit Changes
                const optimizationBranch = `clara-optimize-${Date.now()}`;
                const repoGit = simpleGit(repoPath);
                // Remove the injected config before committing so we don't pollute the repo
                if (fs.existsSync(configPath))
                    fs.unlinkSync(configPath);
                await repoGit.checkoutLocalBranch(optimizationBranch);
                await repoGit.add('.');
                await repoGit.commit(`chore: optimize code (Score: ${score}/100)`);
                console.log(`[Optimizer] Created branch ${optimizationBranch} with fixes.`);
                // await repoGit.push('origin', optimizationBranch); 
            }
            else {
                console.log(`[Optimizer] No fixes applied. Code is clean.`);
                if (fs.existsSync(configPath))
                    fs.unlinkSync(configPath);
            }
            return {
                success: true,
                data: { score, errors: totalErrors, warnings: totalWarnings, fixedFiles: fixedCount }
            };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    }
}
