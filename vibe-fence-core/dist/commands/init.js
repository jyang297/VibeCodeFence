"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initCommand = void 0;
const commander_1 = require("commander");
const fast_glob_1 = require("fast-glob");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const inquirer_1 = __importDefault(require("inquirer"));
const chalk_1 = __importDefault(require("chalk"));
const types_1 = require("../types");
exports.initCommand = new commander_1.Command('init')
    .description('Initialize Vibe Fence configuration interactively')
    .action(async () => {
    const rootPath = process.cwd();
    const fenceDir = path_1.default.join(rootPath, '.fence');
    const configPath = path_1.default.join(fenceDir, 'fence.config.json');
    const gitignorePath = path_1.default.join(rootPath, '.gitignore');
    console.log(chalk_1.default.blue(`⚙️  Initializing Vibe Fence...`));
    // --- 1. Auto-detection Logic ---
    console.log(chalk_1.default.blue(`\n🔍 Auto-detecting project structure...`));
    // 忽略常见构建目录
    const potentialRoots = await (0, fast_glob_1.glob)('**/package.json', {
        ignore: ['**/node_modules/**', '**/.fence/**', '**/dist/**', '**/build/**', '**/.git/**'],
        cwd: process.cwd(),
        deep: 3
    });
    const detectedPaths = [];
    // Case A: Root
    if (potentialRoots.includes('package.json')) {
        console.log(chalk_1.default.gray(`   Found package.json in root.`));
        detectedPaths.push('src/**/*.{ts,tsx,js,jsx}');
    }
    // Case B: Sub-projects
    for (const pkgPath of potentialRoots) {
        if (pkgPath === 'package.json')
            continue;
        const dir = path_1.default.dirname(pkgPath);
        console.log(chalk_1.default.gray(`   Found sub-project in: ${dir}`));
        detectedPaths.push(`${dir}/src/**/*.{ts,tsx,js,jsx}`);
    }
    // --- 2. Path Confirmation ---
    let finalIncludes = [];
    if (detectedPaths.length > 0) {
        console.log(chalk_1.default.green(`   ✅ Detected potential source paths.`));
        const confirm = await inquirer_1.default.prompt([
            {
                type: 'checkbox',
                name: 'paths',
                message: 'Select the paths to include in scanning:',
                choices: detectedPaths.map(p => ({ name: p, value: p, checked: true })),
                validate: (answer) => answer.length > 0 ? true : 'You must choose at least one path.'
            }
        ]);
        finalIncludes = confirm.paths;
    }
    else {
        console.log(chalk_1.default.yellow(`   ⚠️  No standard structure detected.`));
        console.log(chalk_1.default.yellow(`       Using default: src/**/*.{ts,tsx,js,jsx}`));
        finalIncludes = ['src/**/*.{ts,tsx,js,jsx}'];
    }
    // --- 3. Profile Selection ---
    const answers = await inquirer_1.default.prompt([
        {
            type: 'list',
            name: 'profile',
            message: 'How will you use Vibe Fence in this project?',
            choices: [
                { name: '🏂 Solo (Local mode)', value: 'local' },
                { name: '🛡️ Team (Shared mode)', value: 'shared' }
            ]
        }
    ]);
    // --- 4. Build Config (Updated for new Schema) ---
    const config = {
        profile: answers.profile,
        // 默认开启的 Inspector
        inspectors: {
            colors: true,
            customRules: {}
        },
        scanner: {
            maxTokenUsageInfo: types_1.DEFAULT_CONFIG.scanner?.maxTokenUsageInfo ?? 5
        },
        scan: {
            include: finalIncludes,
            exclude: [
                '**/node_modules/**',
                '**/dist/**',
                '**/build/**',
                '**/.next/**',
                '**/coverage/**'
            ]
        }
    };
    // --- 5. Write Config ---
    await fs_extra_1.default.ensureDir(fenceDir);
    await fs_extra_1.default.writeJSON(configPath, config, { spaces: 2 });
    console.log(chalk_1.default.green(`   ✅ Created .fence/fence.config.json`));
    // --- 6. Handle .gitignore ---
    await handleGitignore(gitignorePath, answers.profile === 'local');
    console.log(chalk_1.default.blue(`\n🎉 Initialization Complete!`));
    console.log(`   Run ${chalk_1.default.cyan('fence scan')} to start.`);
});
// 辅助函数保持不变
async function handleGitignore(gitignorePath, isLocal) {
    const ignoreEntry = '.fence';
    if (!await fs_extra_1.default.pathExists(gitignorePath)) {
        await fs_extra_1.default.writeFile(gitignorePath, '');
    }
    let content = await fs_extra_1.default.readFile(gitignorePath, 'utf-8');
    const hasEntry = content.includes(ignoreEntry);
    if (isLocal) {
        if (!hasEntry) {
            const prefix = content.endsWith('\n') || content.length === 0 ? '' : '\n';
            await fs_extra_1.default.appendFile(gitignorePath, `${prefix}# TeamVibeFence Context\n${ignoreEntry}\n`);
            console.log(chalk_1.default.green(`   🙈 Added .fence to .gitignore (Local Mode)`));
        }
    }
    else {
        if (hasEntry) {
            const lines = content.split('\n').filter(line => line.trim() !== ignoreEntry && line.trim() !== '# TeamVibeFence Context');
            await fs_extra_1.default.writeFile(gitignorePath, lines.join('\n'));
            console.log(chalk_1.default.yellow(`   👀 Removed .fence from .gitignore (Shared Mode)`));
        }
    }
}
