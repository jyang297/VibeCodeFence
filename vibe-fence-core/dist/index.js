"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/index.ts
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const histogram_1 = require("./core/histogram");
const scanner_1 = require("./core/scanner");
const program = new commander_1.Command();
program
    .name('fence')
    .description('TeamVibeFence - AI Governance Middleware')
    .version('0.1.0');
program
    .command('scan')
    .description('Scan project and generate vibe context')
    .argument('[path]', 'Project root', '.')
    .action(async (targetPath) => {
    const root = path_1.default.resolve(targetPath);
    console.log(chalk_1.default.blue(`🛡️  TeamVibeFence starting scan in: ${root}`));
    try {
        // 1. 并行执行 AST 解析 和 直方图统计
        const [tokens, components] = await Promise.all([
            (0, histogram_1.scanShadowTokens)(root),
            (0, scanner_1.scanComponents)(root)
        ]);
        // 2. 构建 Context 数据
        const context = {
            schemaVersion: "0.2.1",
            generatedAt: new Date().toISOString(),
            // 🌟 修复点 1: 替换 projectRoot 为 projectInfo
            projectInfo: {
                name: path_1.default.basename(root) // 使用文件夹名作为项目名
            },
            // 🌟 修复点 2: 增加 contentHash (MVP 暂时用简单的组合哈希或时间戳占位)
            contentHash: `hash-${Date.now()}-${components.length}-${tokens.length}`,
            stats: {
                componentCount: components.length,
                tokenCount: tokens.length,
                shadowTokenCount: tokens.filter(t => t.source === 'scan').length // 简单计算
            },
            tokens,
            components
        };
        // 3. 写入 .fence/context.json
        const fenceDir = path_1.default.join(root, '.fence');
        await fs_extra_1.default.ensureDir(fenceDir);
        const outputPath = path_1.default.join(fenceDir, 'context.json');
        await fs_extra_1.default.writeJSON(outputPath, context, { spaces: 2 });
        // 4. 输出报告
        console.log(chalk_1.default.green(`\n✅ Scan Complete!`));
        console.log(`   - Components Processed: ${components.length}`);
        console.log(`   - Shadow Tokens Found: ${tokens.length}`);
        console.log(`   - Context saved to: ${chalk_1.default.underline(outputPath)}`);
        // 5. 展示脱敏效果 (Demo)
        if (components.length > 0) {
            console.log(chalk_1.default.yellow('\n👻 Sanitization Preview (What AI sees):'));
            console.log(chalk_1.default.gray('----------------------------------------'));
            console.log(components[0].skeleton);
            console.log(chalk_1.default.gray('----------------------------------------'));
        }
    }
    catch (error) {
        console.error(chalk_1.default.red('❌ Scan failed:'), error);
    }
});
program.parse();
