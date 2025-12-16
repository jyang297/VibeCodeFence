"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanComponents = scanComponents;
const fast_glob_1 = require("fast-glob");
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
// 1. 🌟 Fix: 引入 ts 命名空间，而不是直接引入 Enum
const ts_morph_1 = require("ts-morph");
const chalk_1 = __importDefault(require("chalk"));
// 2. 🌟 Fix: 确保这里引用的文件存在 (Step 2 会创建它)
const ast_parser_1 = require("../core/ast-parser");
async function scanComponents(root) {
    // 1. 读取 Config
    const configPath = path_1.default.join(root, '.fence/fence.config.json');
    let includePatterns = ['src/**/*.{ts,tsx,js,jsx}'];
    let excludePatterns = ['**/node_modules/**'];
    if (await fs_extra_1.default.pathExists(configPath)) {
        try {
            const config = await fs_extra_1.default.readJSON(configPath);
            if (config.scan?.include)
                includePatterns = config.scan.include;
            if (config.scan?.exclude)
                excludePatterns = config.scan.exclude;
        }
        catch (e) {
            console.warn('⚠️ Config error');
        }
    }
    // 2. 找到所有目标文件
    const files = await (0, fast_glob_1.glob)(includePatterns, {
        cwd: root,
        absolute: true,
        ignore: excludePatterns,
        dot: true
    });
    if (files.length === 0)
        return [];
    // 3. 动态寻找 tsconfig
    const firstFileDir = path_1.default.dirname(files[0]);
    const tsConfigPath = await findUp('tsconfig.json', firstFileDir, root);
    // 4. 🌟 Fix: 使用 ts.ScriptTarget 等枚举
    let compilerOptions = {
        allowJs: true,
        target: ts_morph_1.ts.ScriptTarget.ESNext,
        // 🌟 Fix: ModuleResolutionKind 才是给 moduleResolution 用的，ModuleKind 是给 module 用的
        moduleResolution: ts_morph_1.ts.ModuleResolutionKind.NodeNext,
        noResolve: true,
        skipLibCheck: true,
        jsx: ts_morph_1.ts.JsxEmit.React,
    };
    if (tsConfigPath) {
        console.log(chalk_1.default.blue(`   📘 Loaded CompilerOptions from: ${path_1.default.relative(root, tsConfigPath)}`));
        const tempProject = new ts_morph_1.Project({ tsConfigFilePath: tsConfigPath, skipAddingFilesFromTsConfig: true });
        const loadedOptions = tempProject.getCompilerOptions();
        compilerOptions = {
            ...loadedOptions,
            noResolve: true,
            skipLibCheck: true
        };
    }
    else {
        console.log(chalk_1.default.yellow(`   ⚠️  No tsconfig.json found. Using loose mode defaults.`));
    }
    // 5. 初始化 Project
    const project = new ts_morph_1.Project({
        skipAddingFilesFromTsConfig: true,
        compilerOptions: compilerOptions
    });
    files.forEach(file => project.addSourceFileAtPath(file));
    const components = [];
    for (const sourceFile of project.getSourceFiles()) {
        try {
            const extracted = (0, ast_parser_1.extractComponentInfo)(sourceFile);
            if (extracted)
                components.push(extracted);
        }
        catch (e) { }
    }
    return components;
}
// 辅助函数
async function findUp(filename, startDir, stopDir) {
    let current = startDir;
    while (current.startsWith(stopDir)) {
        const p = path_1.default.join(current, filename);
        if (await fs_extra_1.default.pathExists(p))
            return p;
        if (current === stopDir)
            break;
        current = path_1.default.dirname(current);
    }
    return null;
}
