"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanShadowTokens = scanShadowTokens;
// src/core/histogram.ts
const fast_glob_1 = require("fast-glob");
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const colord_1 = require("colord");
const names_1 = __importDefault(require("colord/plugins/names"));
(0, colord_1.extend)([names_1.default]);
const HEX_COLOR_REGEX = /#(?:[0-9a-fA-F]{3}){1,2}(?![0-9a-fA-F])/g;
// --- 2. 配置探测规则 (The Rules) ---
const DETECTORS = [
    {
        type: 'color',
        // 匹配 Hex, RGB, RGBA
        regex: /#([0-9a-f]{3}){1,2}\b|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|rgba\([^)]+\)/gi,
        normalize: (val) => {
            const c = (0, colord_1.colord)(val);
            return c.isValid() ? c.toHex() : null;
        }
    },
    {
        type: 'spacing',
        // 🌟 重点: 同时捕获 Tailwind Utility 和 Raw CSS Unit
        // 捕获: p-4, m-2, gap-x-4, w-full, h-10
        // 捕获: 16px, 1rem
        regex: /\b([pmWH][tbrlxy]?|gap(-[xy])?|space-[xy])-([0-9.]+|px)\b|\b\d+(\.\d+)?(px|rem|em)\b/g,
        normalize: (val) => val // 暂时直接统计原始值，看哪个用得多
    },
    {
        type: 'radius',
        // 捕获: rounded-lg, rounded-md, rounded-tr-xl
        // 捕获: 8px (如果在 border-radius 上下文比较难区分，这里先粗略捕获)
        regex: /\brounded(-[tbrl][r l]?)?-(sm|md|lg|xl|2xl|3xl|full|none)\b/g,
        normalize: (val) => val
    },
    {
        type: 'typography',
        // 捕获: text-xl, text-sm, font-bold
        regex: /\b(text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl)|font-(thin|light|normal|medium|bold|black))\b/g,
        normalize: (val) => val
    },
    {
        type: 'shadow',
        regex: /\bshadow-(sm|md|lg|xl|2xl|inner|none)\b/g,
        normalize: (val) => val
    }
];
// --- 3. 通用扫描逻辑 ---
async function scanShadowTokens(root) {
    // 1. 🌟 新增: 读取 Config (复用 scanner 的逻辑)
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
            // ignore config error
        }
    }
    // 2. 🌟 修改: 使用 Config 中的路径
    const files = await (0, fast_glob_1.glob)(includePatterns, {
        cwd: root,
        absolute: true,
        ignore: excludePatterns,
        // 允许扫描 . 开头的目录 (如 .storybook 等，如果用户include了)
        dot: true
    });
    const tokenMap = new Map();
    // 3. 遍历文件 (逻辑保持不变)
    for (const file of files) {
        const content = await fs_extra_1.default.readFile(file, 'utf-8');
        // ... 原有的 extractTokensFromText 逻辑 ...
        extractTokensFromText(content, 'color', HEX_COLOR_REGEX, file, tokenMap);
        // extractTokensFromText(content, 'spacing', TAILWIND_SPACING_REGEX, file, tokenMap); // 如果你有这个
    }
    // 转换 Map 到 Array
    return Array.from(tokenMap.values()).sort((a, b) => b.count - a.count);
}
// ... extractTokensFromText 保持不变 ...
function extractTokensFromText(content, type, regex, file, map) {
    let match;
    while ((match = regex.exec(content)) !== null) {
        const value = match[0].toLowerCase(); // 归一化
        const relativePath = path_1.default.basename(file); // 简化路径记录
        if (!map.has(value)) {
            map.set(value, {
                type,
                value,
                count: 0,
                usedBy: [],
                source: 'scan'
            });
        }
        const token = map.get(value);
        token.count++;
        if (!token.usedBy?.includes(relativePath)) {
            token.usedBy?.push(relativePath);
        }
    }
}
