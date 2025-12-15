import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { FenceContext } from '../types';

export const reportCommand = new Command('report')
  .description('Generate a visual health report of your project vibe')
  .action(async () => {
    const root = process.cwd();
    const contextPath = path.join(root, '.fence/context.json');

    // 1. 加载数据
    if (!fs.existsSync(contextPath)) {
      console.log(chalk.red('❌ No context found. Run "fence scan" first.'));
      return;
    }
    const context: FenceContext = await fs.readJSON(contextPath);

    // 2. 计算健康度 (简单算法)
    // 假设每个 Shadow Token 扣 5 分
    const shadowCount = context.tokens.filter(t => t.source === 'scan').length;
    const healthScore = Math.max(0, 100 - (shadowCount * 5));
    
    // 决定评分颜色
    let scoreColor = chalk.green;
    if (healthScore < 80) scoreColor = chalk.yellow;
    if (healthScore < 60) scoreColor = chalk.red;

    // --- 渲染 UI ---
    console.clear();
    console.log(chalk.bold.blue(`\n📊 Vibe Fence Health Report`));
    console.log(chalk.gray(`   Project: ${context.projectInfo.name}`));
    console.log(chalk.gray('========================================'));

    // Section A: Score Card
    console.log(`\n🎯 Vibe Score: ${scoreColor.bold(healthScore + '/100')}`);
    if (healthScore < 100) {
      console.log(chalk.gray(`   (-5 pts per shadow token)`));
    }

    // Section B: Color Consistency (Bar Chart)
    console.log(chalk.bold.white(`\n🎨 Color Palette Usage`));
    
    const colors = context.tokens
      .filter(t => t.type === 'color')
      .sort((a, b) => b.count - a.count) // 按频率排序
      .slice(0, 8); // 只看前 8 个

    const maxCount = Math.max(...colors.map(c => c.count), 1);

    colors.forEach(token => {
      // 计算条形图长度 (最大 20 格)
      const barLength = Math.round((token.count / maxCount) * 20);
      const bar = '█'.repeat(barLength).padEnd(20, '░');
      
      const isShadow = token.source === 'scan';
      const statusIcon = isShadow ? '⚠️ ' : '✅';
      const labelColor = isShadow ? chalk.red : chalk.cyan;

      console.log(
        ` ${statusIcon} ${labelColor(token.value.padEnd(9))} ` +
        `${chalk.blue(bar)} ` +
        `${chalk.white(token.count.toString().padStart(3))} uses ` +
        `${chalk.gray(isShadow ? '(Shadow)' : '(Official)')}`
      );
    });

    // Section C: Component Stats
    console.log(chalk.bold.white(`\n🧩 Component Reuse`));
    console.log(`   Tracked Components: ${chalk.cyan(context.components.length)}`);
    
    // 找出最复杂的组件 (Props 最多)
    const complexComp = context.components.sort((a, b) => b.props.length - a.props.length)[0];
    if (complexComp) {
      console.log(`   Most Complex: ${chalk.yellow(complexComp.name)} (${complexComp.props.length} props)`);
    }

    // Footer
    console.log(chalk.gray('\n========================================'));
    if (shadowCount > 0) {
      console.log(chalk.yellow(`💡 Tip: You have ${shadowCount} shadow tokens.`));
      console.log(chalk.yellow(`   Consider adding them to tokens.json or refactoring.`));
    } else {
      console.log(chalk.green(`✨ Clean vibe! AI will love this codebase.`));
    }
    console.log();
  });