import { Command } from 'commander';
import { glob } from 'fast-glob';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { generateFenceContext } from '../core/runner'; // 复用 Runner

export const scanCommand = new Command('scan')
  .description('Scan project and generate vibe context')
  .argument('[path]', 'Project root', '.')
  .action(async (targetPath) => {
    const root = path.resolve(targetPath);
    console.log(chalk.blue(`🛡️  TeamVibeFence starting scan in: ${root}`));

    try {
      // 1. 核心逻辑: 直接调用 Runner
      // Runner 内部已经处理了并行扫描、AST 解析、Config 读取等所有事情
      const context = await generateFenceContext(root);

      // 2. 写入 .fence/context.json
      const fenceDir = path.join(root, '.fence');
      await fs.ensureDir(fenceDir);

      const outputPath = path.join(fenceDir, 'context.json');
      await fs.writeJSON(outputPath, context, { spaces: 2 });

      // 3. 输出报告 (Reporting)
      // 计算一些统计数据用于展示
      const componentCount = context.components.length;
      const shadowTokenCount = context.tokens.filter(t => t.source === 'scan').length;

      console.log(chalk.green(`\n✅ Scan Complete!`));
      console.log(`   - Components Processed: ${componentCount}`);
      console.log(`   - Shadow Tokens Found: ${shadowTokenCount}`);
      console.log(`   - Context saved to: ${chalk.underline(outputPath)}`);

      // 4. 展示脱敏效果 (Demo)
      if (componentCount > 0) {
        console.log(chalk.yellow('\n🔍 Sanitization Preview (What AI sees):'));
        console.log(chalk.gray('----------------------------------------'));
        // 只展示第一个组件的骨架，证明我们没泄露代码
        console.log(context.components[0].skeleton); 
        console.log(chalk.gray('----------------------------------------'));
      }

    } catch (error) {
      console.error(chalk.red('❌ Scan failed:'), error);
      process.exit(1);
    }
  });