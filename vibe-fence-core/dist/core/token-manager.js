"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTokens = resolveTokens;
exports.mapUsageToTokens = mapUsageToTokens;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const histogram_1 = require("./histogram");
/**
 * 阶段一: 加载并合并 Tokens (Config + Scan)
 */
async function resolveTokens(rootPath) {
    const finalTokenMap = new Map();
    // 1. 尝试加载显式配置 (W3C/Tailwind)
    const configPath = path_1.default.join(rootPath, '.fence/tokens.json');
    if (await fs_extra_1.default.pathExists(configPath)) {
        try {
            const explicitTokens = await fs_extra_1.default.readJSON(configPath);
            explicitTokens.forEach(t => {
                // 强制归一化 key 为小写
                finalTokenMap.set(t.value.toLowerCase(), { ...t, source: 'config', count: 0 });
            });
        }
        catch (e) { /* ignore */ }
    }
    // 2. 运行直方图扫描
    const shadowTokens = await (0, histogram_1.scanShadowTokens)(rootPath);
    // 3. 合并逻辑
    shadowTokens.forEach(shadow => {
        const key = shadow.value.toLowerCase();
        if (finalTokenMap.has(key)) {
            // Case A: Config 里有 -> 更新计数
            const existing = finalTokenMap.get(key);
            existing.count = shadow.count;
        }
        else {
            // Case B: Config 里没有 -> 作为 Shadow Token 加入
            // 阈值控制: 只保留出现次数 > 1 的，过滤绝对噪音
            if (shadow.count > 1) {
                finalTokenMap.set(key, shadow);
            }
        }
    });
    // 初步排序
    return Array.from(finalTokenMap.values()).sort((a, b) => b.count - a.count);
}
/**
 * 阶段二: 建立反向索引 (Components -> Tokens)
 * 这是一个纯内存操作，不涉及 IO，速度极快
 */
function mapUsageToTokens(tokens, components) {
    // 标准化 tokens（关键）
    const tokenMap = new Map();
    const normalizedTokens = tokens.map(t => {
        // 浅拷贝对象，并确保 usedBy 初始化
        const enhanced = { ...t, usedBy: t.usedBy || [] };
        tokenMap.set(enhanced.value.toLowerCase(), enhanced);
        return enhanced;
    });
    // 2. 遍历组件指纹
    components.forEach(comp => {
        // 辅助函数: 将组件名挂载到 Token 上
        const registerUsage = (val) => {
            const key = val.toLowerCase();
            const token = tokenMap.get(key);
            if (!token)
                return;
            token.usedBy ?? (token.usedBy = []);
            if (token) {
                // 策略: 每个 Token 最多记录 5 个典型组件
                // 避免 context.json 膨胀，同时提供足够的 RAG 上下文
                if (token.usedBy.length < 5 && !token.usedBy.includes(comp.name)) {
                    token.usedBy.push(comp.name);
                }
            }
        };
        // 处理颜色
        comp.fingerprint.colors.forEach(registerUsage);
        // 处理间距
        comp.fingerprint.spacings.forEach(registerUsage);
    });
    // 3. 最终排序: Config 优先 -> 引用多优先 -> 频率高优先
    return normalizedTokens.sort((a, b) => {
        if (a.source === 'config' && b.source !== 'config')
            return -1;
        if (a.source !== 'config' && b.source === 'config')
            return 1;
        // 优先展示被引用得多的 Token (说明它是核心 Token)
        const usageDiff = b.usedBy.length - a.usedBy.length;
        if (usageDiff !== 0)
            return usageDiff;
        return b.count - a.count;
    });
}
