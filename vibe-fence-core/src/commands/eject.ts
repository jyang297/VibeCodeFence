import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { generateFenceContext } from '../core/runner';

// 定义支持的目标类型
type EjectTarget = 'cursor' | 'copilot' | 'markdown' | 'mcp-config';

export const ejectCommand = new Command('eject')
  .description('Generate AI context configuration for different tools')
  .option('-t, --target <type>', 'Target platform: cursor, copilot, markdown, mcp-config', 'cursor')
  .action(async (options) => {
    const target: EjectTarget = options.target;
    const root = process.cwd();
    const contextPath = path.join(root, '.fence/context.json');

    // 1. 准备上下文数据
    // 如果没有 context.json，先自动跑一遍 scan
    let context;
    if (!fs.existsSync(contextPath)) {
      console.log(chalk.yellow('⚠️  No context found. Scanning first...'));
      context = await generateFenceContext(root);
    } else {
      context = await fs.readJSON(contextPath);
    }

    // 2. 提取公共核心数据 (Top Tokens)
    // 无论生成什么文件，这些"预加载数据"都是通用的
    const topColors = context.tokens
        .filter((t: any) => t.type === 'color')
        .slice(0, 5)
        .map((t: any) => `${t.value} (${t.usedBy?.slice(0, 2).join(', ') || 'General'})`)
        .join(', ');
    
    const projectSummary = `Project: ${context.projectInfo.name}\nKey Colors: ${topColors}`;

    // 3. 策略分发 (Strategy Dispatch)
    try {
      switch (target) {
        case 'cursor':
          await ejectCursor(root, projectSummary);
          break;
        case 'copilot':
          await ejectCopilot(root, projectSummary);
          break;
        case 'markdown':
          await ejectMarkdown(root, projectSummary);
          break;
        case 'mcp-config':
          await ejectMcpConfig(root); // MCP 需要特殊处理，只打印不写文件
          break;
        default:
          console.log(chalk.red(`❌ Unknown target: ${target}`));
          console.log(`Available targets: cursor, copilot, markdown, mcp-config`);
          process.exit(1);
      }
    } catch (e: any) {
      console.error(chalk.red(`❌ Failed to eject for ${target}: ${e.message}`));
    }
  });

// --- Strategies ---

// 策略 A: Cursor (.cursorrules)
async function ejectCursor(root: string, summary: string) {
  const content = `
# Vibe Fence Rules
${summary}

## Behavior
You are a Senior Frontend Developer. strict adherence to the design system is required.

## Tools
To get detailed style information, you MUST use the CLI:
- Global Context: \`npx fence query -t get_profile --args '{}'\`
- Component Detail: \`npx fence query -t get_component --args '{"componentName": "Button"}'\`

## Workflow
Before writing UI code, ALWAYS query the component context first.
`.trim();

  const dest = path.join(root, '.cursorrules');
  await writeWithBackup(dest, content);
  console.log(chalk.green(`✅ Ejected .cursorrules for Cursor.`));
}

// 策略 B: GitHub Copilot (.github/copilot-instructions.md)
async function ejectCopilot(root: string, summary: string) {
  const content = `
# Copilot Instructions for ${summary}

The user uses Vibe Fence to manage design tokens.
When asked about styles or creating components, please infer patterns from the following CLI commands:

Run \`npx fence query -t get_profile --args '{}'\` to see global tokens.
`.trim();

  const dir = path.join(root, '.github');
  await fs.ensureDir(dir);
  const dest = path.join(dir, 'copilot-instructions.md');
  await writeWithBackup(dest, content);
  console.log(chalk.green(`✅ Ejected .github/copilot-instructions.md for Copilot.`));
}

// 策略 C: Generic Markdown (VIBE_PROMPT.md)
async function ejectMarkdown(root: string, summary: string) {
  const content = `
---
# System Prompt
Copy and paste this into ChatGPT or Claude Web.
---

I am working on a project: ${summary}

I have a CLI tool called 'fence' that provides context.
Since you cannot run CLI commands, I will paste the output of \`fence query\` for you when needed.

If you need more context about a component, ask me to run:
\`fence query -t get_component --args '{"componentName": "..."}'\`
`.trim();

  const dest = path.join(root, 'VIBE_PROMPT.md');
  await writeWithBackup(dest, content);
  console.log(chalk.green(`✅ Ejected VIBE_PROMPT.md for generic LLMs.`));
}

// 策略 D: MCP Config (Stdout only)
async function ejectMcpConfig(root: string) {
  // 这是为了给 Claude Desktop 用的配置
  // 注意：这里我们假设用户使用 'node' 来运行 CLI wrapper
  // 在真实场景中，我们可能需要一个专门的 mcp-server.js 适配器
  // 这里暂时打印一个 placeholder 供用户参考
  const config = {
    "mcpServers": {
      "vibe-fence": {
        "command": "node",
        "args": [path.join(root, "dist/index.js"), "mcp-run"] // 假设未来我们实现 mcp-run 命令
      }
    }
  };

  console.log(chalk.blue(`\nℹ️  Add this to your Claude Desktop config:`));
  console.log(JSON.stringify(config, null, 2));
  console.log(chalk.gray(`(Note: This requires an 'mcp-run' command which wraps the CLI in stdio mode)`));
}

// 辅助函数：写文件前备份
async function writeWithBackup(filepath: string, content: string) {
  if (await fs.pathExists(filepath)) {
    await fs.move(filepath, `${filepath}.bak`, { overwrite: true });
    console.log(chalk.gray(`   📦 Backed up existing ${path.basename(filepath)}`));
  }
  await fs.writeFile(filepath, content);
}