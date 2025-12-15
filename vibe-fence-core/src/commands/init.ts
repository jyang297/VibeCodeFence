import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
// 使用相对路径以确保安全
import { DEFAULT_CONFIG } from '../types'; 

export const initCommand = new Command('init')
  .description('Initialize Vibe Fence configuration interactively')
  .action(async () => {
    const rootPath = process.cwd();
    const fenceDir = path.join(rootPath, '.fence');
    const configPath = path.join(fenceDir, 'fence.config.json');
    const gitignorePath = path.join(rootPath, '.gitignore');

    console.log(chalk.blue(`⚙️  Initializing Vibe Fence...`));

    // 1. 交互式询问
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'profile',
        message: 'How will you use Vibe Fence in this project?',
        choices: [
          { 
            name: '🏂 Solo (Local mode)', 
            value: 'local',
            short: 'Solo'
          },
          { 
            name: '🛡️ Team (Shared mode, commits config)', 
            value: 'shared',
            short: 'Team'
          }
        ]
      }
    ]);

    // 2. 构建配置对象
    // 修复了之前的 key 命名错误
    const config = {
      profile: answers.profile,
      strict: false,
      scanner: {
        // 使用默认配置中的数值，或者硬编码一个合理的默认值 (e.g. 5)
        maxTokenUsageInfo: DEFAULT_CONFIG.scanner?.maxTokenUsageInfo ?? 5
      }
    };

    // 3. 写入 Config 文件
    await fs.ensureDir(fenceDir);
    await fs.writeJSON(configPath, config, { spaces: 2 });
    console.log(chalk.green(`   ✅ Created .fence/fence.config.json`));

    // 4. 智能处理 .gitignore
    await handleGitignore(gitignorePath, answers.profile === 'local');

    console.log(chalk.blue(`\n🎉 Initialization Complete!`));
    console.log(`   Run ${chalk.cyan('fence scan')} to generate your first context.`);
  });

/**
 * 辅助函数：处理 .gitignore 逻辑
 * Solo 模式 -> 添加 .fence
 * Team 模式 -> 移除 .fence
 */
async function handleGitignore(gitignorePath: string, isLocal: boolean) {
  const ignoreEntry = '.fence';
  
  // 如果文件不存在，创建一个空的
  if (!await fs.pathExists(gitignorePath)) {
    await fs.writeFile(gitignorePath, '');
  }

  let content = await fs.readFile(gitignorePath, 'utf-8');
  const hasEntry = content.includes(ignoreEntry);

  if (isLocal) {
    // 🏂 Local Mode: 必须忽略
    if (!hasEntry) {
      // 确保在新的一行添加
      const prefix = content.endsWith('\n') || content.length === 0 ? '' : '\n';
      await fs.appendFile(gitignorePath, `${prefix}# TeamVibeFence Context\n${ignoreEntry}\n`);
      console.log(chalk.green(`   🙈 Added .fence to .gitignore (Local Mode)`));
    }
  } else {
    // 🛡️ Shared Mode: 必须提交 (不能忽略)
    if (hasEntry) {
      // 简单的行删除逻辑
      const lines = content.split('\n').filter(line => line.trim() !== ignoreEntry && line.trim() !== '# TeamVibeFence Context');
      await fs.writeFile(gitignorePath, lines.join('\n'));
      console.log(chalk.yellow(`   👀 Removed .fence from .gitignore (Shared Mode)`));
    }
  }
}