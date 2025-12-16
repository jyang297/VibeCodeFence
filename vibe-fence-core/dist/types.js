"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONFIG = void 0;
// 🌟 修复: 导出默认配置
exports.DEFAULT_CONFIG = {
    profile: 'local', // 默认为 Local
    scan: {
        include: ['src/**/*.{ts,tsx,js,jsx}'],
        exclude: ['**/node_modules/**', '**/dist/**', '**/build/**']
    },
    inspectors: {
        colors: true
    },
    scanner: {
        maxTokenUsageInfo: 5
    }
};
