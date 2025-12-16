"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanComponents = scanComponents;
const ts_morph_1 = require("ts-morph");
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const chalk_1 = __importDefault(require("chalk"));
const ast_parser_1 = require("./ast-parser");
/**
 * 组件扫描器
 * 专注于 AST 解析，提取结构化组件信息
 */
async function scanComponents(files, root) {
    if (files.length === 0)
        return [];
    // 1. Context-Aware Config Loading
    const firstFileDir = path_1.default.dirname(files[0]);
    const tsConfigPath = await findUp('tsconfig.json', firstFileDir, root);
    let compilerOptions = {
        allowJs: true,
        target: ts_morph_1.ts.ScriptTarget.ESNext,
        moduleResolution: ts_morph_1.ts.ModuleResolutionKind.NodeNext,
        noResolve: true,
        skipLibCheck: true,
        jsx: ts_morph_1.ts.JsxEmit.React,
    };
    if (tsConfigPath) {
        console.log(chalk_1.default.blue(`   📘 Loaded CompilerOptions from: ${path_1.default.relative(root, tsConfigPath)}`));
        const tempProject = new ts_morph_1.Project({ tsConfigFilePath: tsConfigPath, skipAddingFilesFromTsConfig: true });
        // 合并配置，但保持鲁棒性覆盖
        Object.assign(compilerOptions, tempProject.getCompilerOptions(), {
            noResolve: true,
            skipLibCheck: true
        });
    }
    // 2. Init Project
    const project = new ts_morph_1.Project({
        skipAddingFilesFromTsConfig: true,
        compilerOptions: compilerOptions
    });
    // 3. Load Files
    files.forEach(file => project.addSourceFileAtPath(file));
    // 4. Parse & Extract
    const components = [];
    for (const sourceFile of project.getSourceFiles()) {
        try {
            // extractComponentInfo 现在会返回 name, filePath, fingerprint 等
            const extracted = (0, ast_parser_1.extractComponentInfo)(sourceFile);
            if (extracted) {
                // 这里我们可以做一步相对路径转换，让 Context 里的路径更干净
                extracted.filePath = path_1.default.relative(root, extracted.filePath);
                components.push(extracted);
            }
        }
        catch (e) {
            // Skip failed files
        }
    }
    return components;
}
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
