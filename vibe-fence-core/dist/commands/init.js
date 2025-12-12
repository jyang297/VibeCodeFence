"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initFence = initFence;
// src/commands/init.ts
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const inquirer_1 = __importDefault(require("inquirer")); // 需要 npm install inquirer
const chalk_1 = __importDefault(require("chalk"));
async function initFence(rootPath) {
    const fenceDir = path_1.default.join(rootPath, '.fence');
    const configPath = path_1.default.join(fenceDir, 'fence.config.json');
    const gitignorePath = path_1.default.join(rootPath, '.gitignore');
    // 1. 询问用户
    const answers = await inquirer_1.default.prompt([
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
        updatedAt: new Date().toISOString()
    };
    // 2. 写入 Config
    await fs_extra_1.default.ensureDir(fenceDir);
    await fs_extra_1.default.writeJSON(configPath, config, { spaces: 2 });
    // 3. 处理 .gitignore
    let gitignoreContent = '';
    if (await fs_extra_1.default.pathExists(gitignorePath)) {
        gitignoreContent = await fs_extra_1.default.readFile(gitignorePath, 'utf-8');
    }
    const ignoreEntry = '.fence';
    const hasIgnore = gitignoreContent.includes(ignoreEntry);
    if (answers.profile === 'local') {
        // 🏂 Solo: 必须 Ignore
        if (!hasIgnore) {
            await fs_extra_1.default.appendFile(gitignorePath, `\n# TeamVibeFence\n${ignoreEntry}\n`);
            console.log(chalk_1.default.green(`✔ Added .fence to .gitignore`));
        }
    }
    else {
        // 🛡️ Team: 必须 Commit (从 gitignore 移除)
        if (hasIgnore) {
            // 简单的移除逻辑 (正则替换)
            const newContent = gitignoreContent.replace(new RegExp(`\\n?${ignoreEntry}\\n?`, 'g'), '\n');
            await fs_extra_1.default.writeFile(gitignorePath, newContent);
            console.log(chalk_1.default.yellow(`✔ Removed .fence from .gitignore (Ready to commit)`));
        }
    }
    console.log(chalk_1.default.blue(`\n✅ Fence initialized in ${answers.profile} mode!`));
    console.log(`Run ${chalk_1.default.bold('fence scan')} to generate your first context.`);
}
