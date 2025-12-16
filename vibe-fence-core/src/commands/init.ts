import { Command } from 'commander';
import { glob } from 'fast-glob';
import fs from 'fs-extra';
import path from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { FenceConfig, DEFAULT_CONFIG } from '@/types';

export const initCommand = new Command('init')
  .description('Initialize Vibe Fence configuration interactively')
  .action(async () => {
    const rootPath = process.cwd();
    const fenceDir = path.join(rootPath, '.fence');
    const configPath = path.join(fenceDir, 'fence.config.json');
    const gitignorePath = path.join(rootPath, '.gitignore');

    console.log(chalk.blue(`⚙️  Initializing Vibe Fence...`));

    // --- 1. Auto-detection Logic ---
    console.log(chalk.blue(`\n🔍 Auto-detecting project structure...`));
    
    // 忽略常见构建目录
    const potentialRoots = await glob('**/package.json', {
      ignore: ['**/node_modules/**', '**/.fence/**', '**/dist/**', '**/build/**', '**/.git/**'],
      cwd: process.cwd(),
      deep: 3 
    });

    const detectedPaths: string[] = [];

    // Case A: Root
    if (potentialRoots.includes('package.json')) {
      console.log(chalk.gray(`   Found package.json in root.`));
      detectedPaths.push('src/**/*.{ts,tsx,js,jsx}');
    }

    // Case B: Sub-projects
    for (const pkgPath of potentialRoots) {
      if (pkgPath === 'package.json') continue;
      const dir = path.dirname(pkgPath);
      console.log(chalk.gray(`   Found sub-project in: ${dir}`));
      detectedPaths.push(`${dir}/src/**/*.{ts,tsx,js,jsx}`);
    }

    // --- 2. Path Confirmation ---
    let finalIncludes: string[] = [];

    if (detectedPaths.length > 0) {
      console.log(chalk.green(`   ✅ Detected potential source paths.`));
      const confirm = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'paths',
          message: 'Select the paths to include in scanning:',
          choices: detectedPaths.map(p => ({ name: p, value: p, checked: true })),
          validate: (answer) => answer.length > 0 ? true : 'You must choose at least one path.'
        }
      ]);
      finalIncludes = confirm.paths;
    } else {
      console.log(chalk.yellow(`   ⚠️  No standard structure detected.`));
      console.log(chalk.yellow(`       Using default: src/**/*.{ts,tsx,js,jsx}`));
      finalIncludes = ['src/**/*.{ts,tsx,js,jsx}'];
    }
      
    // --- 3. Profile Selection ---
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'profile',
        message: 'How will you use Vibe Fence in this project?',
        choices: [
          { name: '🏂 Solo (Local mode)', value: 'local' },
          { name: '🛡️ Team (Shared mode)', value: 'shared' }
        ]
      }
    ]);

    // --- 4. Build Config (Updated for new Schema) ---
    const config: FenceConfig = {
      profile: answers.profile,
      // 默认开启的 Inspector
      inspectors: {
        colors: true,
        customRules: {}
      },
      scanner: {
        maxTokenUsageInfo: DEFAULT_CONFIG.scanner?.maxTokenUsageInfo ?? 5
      },
      scan: {
        include: finalIncludes,
        exclude: [
          '**/node_modules/**',
          '**/dist/**',
          '**/build/**',
          '**/.next/**',
          '**/coverage/**'
        ]
      }
    };

    // --- 5. Write Config ---
    await fs.ensureDir(fenceDir);
    await fs.writeJSON(configPath, config, { spaces: 2 });
    console.log(chalk.green(`   ✅ Created .fence/fence.config.json`));

    // --- 6. Handle .gitignore ---
    await handleGitignore(gitignorePath, answers.profile === 'local');

    console.log(chalk.blue(`\n🎉 Initialization Complete!`));
    console.log(`   Run ${chalk.cyan('fence scan')} to start.`);
  });

// 辅助函数保持不变
async function handleGitignore(gitignorePath: string, isLocal: boolean) {
    const ignoreEntry = '.fence';
    if (!await fs.pathExists(gitignorePath)) {
        await fs.writeFile(gitignorePath, '');
    }
    let content = await fs.readFile(gitignorePath, 'utf-8');
    const hasEntry = content.includes(ignoreEntry);

    if (isLocal) {
        if (!hasEntry) {
            const prefix = content.endsWith('\n') || content.length === 0 ? '' : '\n';
            await fs.appendFile(gitignorePath, `${prefix}# TeamVibeFence Context\n${ignoreEntry}\n`);
            console.log(chalk.green(`   🙈 Added .fence to .gitignore (Local Mode)`));
        }
    } else {
        if (hasEntry) {
            const lines = content.split('\n').filter(line => line.trim() !== ignoreEntry && line.trim() !== '# TeamVibeFence Context');
            await fs.writeFile(gitignorePath, lines.join('\n'));
            console.log(chalk.yellow(`   👀 Removed .fence from .gitignore (Shared Mode)`));
        }
    }
}