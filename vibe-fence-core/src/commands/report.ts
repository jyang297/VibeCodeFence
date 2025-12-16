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

    if (!fs.existsSync(contextPath)) {
      console.log(chalk.red('❌ No context found. Run "fence scan" first.'));
      return;
    }
    const context: FenceContext = await fs.readJSON(contextPath);

    // 计算分数 (Demo Logic)
    const totalComps = context.stats.componentCount;
    // 假设有 Shadow Tokens 扣分
    const shadowCount = context.stats.shadowTokenCount;
    const healthScore = Math.max(0, 100 - (shadowCount * 2)); // 每个 Shadow Token 扣 2 分
    
    let scoreColor = chalk.green;
    if (healthScore < 80) scoreColor = chalk.yellow;
    if (healthScore < 60) scoreColor = chalk.red;

    console.clear();
    console.log(chalk.bold.blue(`\n📊 Vibe Fence Report: ${context.projectInfo.name}`));
    console.log(chalk.gray(`   Generated: ${new Date(context.generatedAt).toLocaleString()}`));
    console.log(chalk.gray('========================================'));

    // --- Section 1: Overview ---
    console.log(`\n🎯 Vibe Health: ${scoreColor.bold(healthScore + '/100')}`);
    console.log(`   Components: ${totalComps}`);
    console.log(`   Global Tokens: ${context.stats.tokenCount}`);

    // --- Section 2: Layout Constraints Analysis (NEW) ---
    console.log(chalk.bold.white(`\n🏗️  Layout Rigidness Analysis`));
    
    // 统计有多少组件是“刚性”的
    const rigidComps = context.components.filter(c => c.fingerprint.constraints.hasFixedDimensions);
    const flexComps = context.components.filter(c => c.fingerprint.constraints.isFlexOrGrid);

    console.log(`   Flexible (Safe): ${chalk.green(flexComps.length)} components (Flex/Grid)`);
    console.log(`   Rigid (Caution): ${chalk.yellow(rigidComps.length)} components (Fixed w/h)`);
    
    if (rigidComps.length > 0) {
        console.log(chalk.gray(`   ⚠️  AI might break layout in these rigid components:`));
        rigidComps.slice(0, 3).forEach(c => console.log(`      - ${c.name}`));
        if (rigidComps.length > 3) console.log(`      ...and ${rigidComps.length - 3} others`);
    }

    // --- Section 3: Color Palette ---
    console.log(chalk.bold.white(`\n🎨 Dominant Colors`));
    const colors = context.tokens.filter(t => t.type === 'color').slice(0, 5);
    
    colors.forEach(t => {
        const bar = '█'.repeat(Math.min(t.count, 20));
        console.log(`   ${chalk.hex(t.value.startsWith('#') ? t.value : '#fff')(t.value.padEnd(10))} ${chalk.blue(bar)} ${t.count}`);
    });

    // --- Section 4: Style Patterns (NEW) ---
    console.log(chalk.bold.white(`\n🧩 Common Vibe Patterns`));
    // 简单的聚合统计
    const patternMap = new Map<string, number>();
    context.components.forEach(c => {
        c.fingerprint.stylePatterns.forEach(p => {
            patternMap.set(p, (patternMap.get(p) || 0) + 1);
        });
    });
    
    // 取出最常用的 3 个组合
    const topPatterns = Array.from(patternMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
        
    if (topPatterns.length > 0) {
        topPatterns.forEach(([pat, count]) => {
            console.log(`   "${chalk.cyan(pat)}" (used in ${count} places)`);
        });
    } else {
        console.log(chalk.gray(`   No distinctive patterns found.`));
    }

    console.log(chalk.gray('\n========================================'));
  });