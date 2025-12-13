// src/commands/init.ts
import fs from 'fs-extra';
import path from 'path';
import inquirer from 'inquirer'; // 需要 npm install inquirer
import chalk from 'chalk';
import { mapUsageToTokens } from '@/core/token-manager';
import { DEFAULT_CONFIG } from '@/types';

export async function initFence(rootPath: string) {
  const fenceDir = path.join(rootPath, '.fence');
  const configPath = path.join(fenceDir, 'fence.config.json');
  const gitignorePath = path.join(rootPath, '.gitignore');

  // 1. 询问用户
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'profile',
      message: 'How are you working on this project?',
      choices: [
        { name: '🏂 Solo (Local only, added to .gitignore)', value: 'local' },
        { name: '🛡️ Team (Shared via Git, SSOT)', value: 'shared' }
      ]
    }
  ]);

  const config = {
    profile: answers.profile,
    strict: false, // 默认为 false (Light Mode)，即使是 Team 也建议先渐进式引入
    scanner: {
      mapUsageToTokens: DEFAULT_CONFIG.scanner!.maxTokenUsageInfo
    }
  };

  // 2. 写入 Config
  await fs.ensureDir(fenceDir);
  await fs.writeJSON(configPath, config, { spaces: 2 });

  // 3. 处理 .gitignore
  let gitignoreContent = '';
  if (await fs.pathExists(gitignorePath)) {
    gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
  }

  const ignoreEntry = '.fence';
  const hasIgnore = gitignoreContent.includes(ignoreEntry);

  if (answers.profile === 'local') {
    // 🏂 Solo: 必须 Ignore
    if (!hasIgnore) {
      await fs.appendFile(gitignorePath, `\n# TeamVibeFence\n${ignoreEntry}\n`);
      console.log(chalk.green(`✔ Added .fence to .gitignore`));
    }
  } else {
    // 🛡️ Team: 必须 Commit (从 gitignore 移除)
    if (hasIgnore) {
      // 简单的移除逻辑 (正则替换)
      const newContent = gitignoreContent.replace(new RegExp(`\\n?${ignoreEntry}\\n?`, 'g'), '\n');
      await fs.writeFile(gitignorePath, newContent);
      console.log(chalk.yellow(`✔ Removed .fence from .gitignore (Ready to commit)`));
    }
  }

  console.log(chalk.blue(`\n✅ Fence initialized in ${answers.profile} mode!`));
  console.log(`Run ${chalk.bold('fence scan')} to generate your first context.`);
}
