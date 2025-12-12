"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanShadowTokens = scanShadowTokens;
// src/core/histogram.ts
const fast_glob_1 = __importDefault(require("fast-glob"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const colord_1 = require("colord");
const names_1 = __importDefault(require("colord/plugins/names"));
(0, colord_1.extend)([names_1.default]);
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
async function scanShadowTokens(rootPath) {
    // 存储结构: { 'color': { '#fff': 10 }, 'spacing': { 'p-4': 50 } }
    const stats = {};
    // 初始化 Map
    DETECTORS.forEach(d => stats[d.type] = new Map());
    const files = await (0, fast_glob_1.default)([`${rootPath}/src/**/*.{tsx,jsx,css,scss,ts}`], {
        ignore: ['**/node_modules/**', '**/.fence/**']
    });
    for (const file of files) {
        const content = await fs_extra_1.default.readFile(file, 'utf-8');
        // 遍历所有探测器
        DETECTORS.forEach(detector => {
            const matches = content.match(detector.regex);
            if (matches) {
                matches.forEach(raw => {
                    const normalized = detector.normalize ? detector.normalize(raw) : raw;
                    if (normalized) {
                        const map = stats[detector.type];
                        map.set(normalized, (map.get(normalized) || 0) + 1);
                    }
                });
            }
        });
    }
    // --- 4. 扁平化结果 ---
    const results = [];
    Object.entries(stats).forEach(([type, map]) => {
        // 对每种类型，取 Top 10 (避免噪音太多)
        const topEntries = Array.from(map.entries())
            .sort((a, b) => b[1] - a[1]) // 降序
            .slice(0, 10); // 只取前10名
        topEntries.forEach(([value, count]) => {
            results.push({
                type: type,
                value,
                count,
                source: 'scan'
            });
        });
    });
    // 全局再按频率排一次序，让高频的排前面
    return results.sort((a, b) => b.count - a.count);
}
