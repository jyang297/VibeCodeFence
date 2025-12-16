import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { loadTargetFiles } from '@/utils/file-loader';
import { scanComponents } from '../core/scanner';
import { inspectStyles } from '../core/style-inspector'; // 改名后的引用
import { FenceConfig, FenceContext } from '../types';

export const scanCommand = new Command('scan')
  .description('Scan project and generate vibe context')
  .argument('[path]', 'Project root', '.')
  .action(async (targetPath) => {
    const root = path.resolve(targetPath);
    console.log(chalk.blue(`🛡️  TeamVibeFence starting scan in: ${root}`));

    try {
      // 1. Discovery (Loader)
      const files = await loadTargetFiles(root);
      if (files.length === 0) {
        console.log(chalk.yellow('   ⚠️ No files found.'));
        return;
      }

      // 2. Load Config (为了传递给 inspectors)
      const configPath = path.join(root, '.fence/fence.config.json');
      let userConfig: FenceConfig | undefined;
      if (await fs.pathExists(configPath)) {
        userConfig = await fs.readJSON(configPath);
      }

      console.log(chalk.blue(`   Processing AST & Styles...`));

      // 3. Parallel Execution (Scanner + Inspector)
      const [components, tokens] = await Promise.all([
        scanComponents(files, root),
        inspectStyles(files, root, userConfig?.inspectors)
      ]);

      // 4. Data Aggregation (构建 SSOT)
      const context: FenceContext = {
        schemaVersion: "0.2.1",
        generatedAt: new Date().toISOString(),
        // 简单的 Hash，用于判断 Context 是否变化
        projectInfo: { name: path.basename(root) },
        stats: {
          componentCount: components.length,
          tokenCount: tokens.length,
          shadowTokenCount: tokens.filter(t => t.source === 'scan').length
        },
        tokens: tokens,
        components: components
      };

      // 5. Persistence
      const fenceDir = path.join(root, '.fence');
      await fs.ensureDir(fenceDir);
      await fs.writeJSON(path.join(fenceDir, 'context.json'), context, { spaces: 2 });

      // 6. Report
      console.log(chalk.green(`\n✅ Scan Complete!`));
      console.log(`   - Components: ${components.length}`);
      console.log(`   - Global Tokens: ${tokens.length}`);
      
      // 验证链接：打印几个 Token 的 usedBy 看看
      if (tokens.length > 0) {
         console.log(chalk.gray(`   Example Token: ${tokens[0].value} used in ${tokens[0].usedBy.length} files`));
      }

    } catch (error) {
      console.error(chalk.red('❌ Scan failed:'), error);
      process.exit(1);
    }
  });