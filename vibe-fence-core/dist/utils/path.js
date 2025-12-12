"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toPosixPath = toPosixPath;
exports.getRelativePosixPath = getRelativePosixPath;
// src/utils/path.ts
const path_1 = __importDefault(require("path"));
/**
 * 将任意路径转换为 POSIX 风格 (使用 / 分隔)
 * 解决了 Windows (\) 和 macOS (/) 路径分隔符不一致导致的 Git 冲突
 */
function toPosixPath(rawPath) {
    // 核心逻辑：将所有的反斜杠 (\) 替换为正斜杠 (/)
    // 在 Windows 上，路径是 a\b\c -> a/b/c
    // 在 Mac/Linux 上，路径是 a/b/c -> a/b/c (无变化)
    return rawPath.split(path_1.default.sep).join(path_1.default.posix.sep);
}
/**
 * 获取相对于项目根目录的 POSIX 路径
 * @param rootPath 项目根目录 (绝对路径)
 * @param filePath 目标文件 (绝对路径)
 */
function getRelativePosixPath(rootPath, filePath) {
    // 1. 先计算相对路径 (此时可能包含 win32 分隔符)
    const relativePath = path_1.default.relative(rootPath, filePath);
    // 2. 再标准化为 POSIX
    return toPosixPath(relativePath);
}
