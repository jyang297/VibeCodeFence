"use strict";
// src/types.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONFIG = void 0;
exports.DEFAULT_CONFIG = {
    scan: {
        include: ['src/**/*.{ts,tsx,js,jsx}'],
        exclude: ['node_modules/**', 'dist/**', 'build/**']
    },
    profile: 'local',
    strict: false,
    scanner: {
        maxTokenUsageInfo: 5 // 默认值
    }
};
