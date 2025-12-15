"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initCommand = void 0;
const commander_1 = require("commander");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const inquirer_1 = __importDefault(require("inquirer"));
const chalk_1 = __importDefault(require("chalk"));
// 使用相对路径以确保安全
const types_1 = require("../types");
exports.initCommand = new commander_1.Command('init')
    .description('Initialize Vibe Fence configuration interactively')
    .action(async () => {
    const rootPath = process.cwd();
    const fenceDir = path_1.default.join(rootPath, '.fence');
    const configPath = path_1.default.join(fenceDir, 'fence.config.json');
    const gitignorePath = path_1.default.join(rootPath, '.gitignore');
    console.log(chalk_1.default.blue(`⚙️  Initializing Vibe Fence...`));
    // 1. 交互式询问
    const answers = await inquirer_1.default.prompt([
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
            maxTokenUsageInfo: types_1.DEFAULT_CONFIG.scanner?.maxTokenUsageInfo ?? 5
        }
    };
    // 3. 写入 Config 文件
    await fs_extra_1.default.ensureDir(fenceDir);
    await fs_extra_1.default.writeJSON(configPath, config, { spaces: 2 });
    console.log(chalk_1.default.green(`   ✅ Created .fence/fence.config.json`));
    // 4. 智能处理 .gitignore
    await handleGitignore(gitignorePath, answers.profile === 'local');
    console.log(chalk_1.default.blue(`\n🎉 Initialization Complete!`));
    console.log(`   Run ${chalk_1.default.cyan('fence scan')} to generate your first context.`);
});
/**
 * 辅助函数：处理 .gitignore 逻辑
 * Solo 模式 -> 添加 .fence
 * Team 模式 -> 移除 .fence
 */
async function handleGitignore(gitignorePath, isLocal) {
    const ignoreEntry = '.fence';
    // 如果文件不存在，创建一个空的
    if (!await fs_extra_1.default.pathExists(gitignorePath)) {
        await fs_extra_1.default.writeFile(gitignorePath, '');
    }
    let content = await fs_extra_1.default.readFile(gitignorePath, 'utf-8');
    const hasEntry = content.includes(ignoreEntry);
    if (isLocal) {
        // 🏂 Local Mode: 必须忽略
        if (!hasEntry) {
            // 确保在新的一行添加
            const prefix = content.endsWith('\n') || content.length === 0 ? '' : '\n';
            await fs_extra_1.default.appendFile(gitignorePath, `${prefix}# TeamVibeFence Context\n${ignoreEntry}\n`);
            console.log(chalk_1.default.green(`   🙈 Added .fence to .gitignore (Local Mode)`));
        }
    }
    else {
        // 🛡️ Shared Mode: 必须提交 (不能忽略)
        if (hasEntry) {
            // 简单的行删除逻辑
            const lines = content.split('\n').filter(line => line.trim() !== ignoreEntry && line.trim() !== '# TeamVibeFence Context');
            await fs_extra_1.default.writeFile(gitignorePath, lines.join('\n'));
            console.log(chalk_1.default.yellow(`   👀 Removed .fence from .gitignore (Shared Mode)`));
        }
    }
}
