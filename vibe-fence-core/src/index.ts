// src/index.ts
import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { scanShadowTokens } from './core/histogram';
import { scanComponents } from './core/scanner';
import { FenceContext } from './types';

const program = new Command();

program
  .name('fence')
  .description('TeamVibeFence - AI Governance Middleware')
  .version('0.1.0');

program
  .command('scan')
  .description('Scan project and generate vibe context')
  .argument('[path]', 'Project root', '.')
  .action(async (targetPath) => {
    const root = path.resolve(targetPath);
    console.log(chalk.blue(`🛡️  TeamVibeFence starting scan in: ${root}`));

    try {
      // 1. 并行执行 AST 解析 和 直方图统计
      const [tokens, components] = await Promise.all([
        scanShadowTokens(root),
        scanComponents(root)
      ]);

      // 2. 构建 Context 数据
      const context: FenceContext = {
        generatedAt: new Date().toISOString(),
        projectRoot: root,
        tokens,
        components
      };

      // 3. 写入 .fence/context.json
      const fenceDir = path.join(root, '.fence');
      await fs.ensureDir(fenceDir);

      const outputPath = path.join(fenceDir, 'context.json');
      await fs.writeJSON(outputPath, context, { spaces: 2 });

      // 4. 输出报告
      console.log(chalk.green(`\n✅ Scan Complete!`));
      console.log(`   - Components Processed: ${components.length}`);
      console.log(`   - Shadow Tokens Found: ${tokens.length}`);
      console.log(`   - Context saved to: ${chalk.underline(outputPath)}`);

      // 5. 展示脱敏效果 (Demo)
      if (components.length > 0) {
        console.log(chalk.yellow('\n👻 Sanitization Preview (What AI sees):'));
        console.log(chalk.gray('----------------------------------------'));
        console.log(components[0].skeleton);
        console.log(chalk.gray('----------------------------------------'));
      }

    } catch (error) {
      console.error(chalk.red('❌ Scan failed:'), error);
    }
  });

program.parse();
