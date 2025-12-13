"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateFenceContext = generateFenceContext;
// src/core/runner.ts
const histogram_1 = require("./histogram"); // 假设你之前合并到了这里
const scanner_1 = require("./scanner");
const path_1 = __importDefault(require("path"));
/**
 * 核心运行逻辑：不依赖 CLI 环境，纯函数
 * 输入：项目根目录路径
 * 输出：完整的 FenceContext 对象
 */
async function generateFenceContext(rootPath) {
    // 1. 并行执行扫描
    const [tokens, components] = await Promise.all([
        (0, histogram_1.scanShadowTokens)(rootPath),
        (0, scanner_1.scanComponents)(rootPath)
    ]);
    const shadowTokenCount = tokens.filter(t => t.source === 'scan').length;
    // 2. 构建数据
    const context = {
        schemaVersion: "0.2.1",
        generatedAt: new Date().toISOString(), // 注意：测试时这可能导致快照不匹配，稍后处理
        contentHash: `hash-${components.length}-${tokens.length}`, // 简化的 Hash
        projectInfo: {
            name: path_1.default.basename(rootPath)
        },
        stats: {
            componentCount: components.length,
            tokenCount: tokens.length,
            shadowTokenCount
        },
        tokens,
        components
    };
    return context;
}
