// src/utils/path.ts
import path from 'path';

/**
 * 将任意路径转换为 POSIX 风格 (使用 / 分隔)
 * 解决了 Windows (\) 和 macOS (/) 路径分隔符不一致导致的 Git 冲突
 */
export function toPosixPath(rawPath: string): string {
  // 核心逻辑：将所有的反斜杠 (\) 替换为正斜杠 (/)
  // 在 Windows 上，路径是 a\b\c -> a/b/c
  // 在 Mac/Linux 上，路径是 a/b/c -> a/b/c (无变化)
  return rawPath.split(path.sep).join(path.posix.sep);
}

/**
 * 获取相对于项目根目录的 POSIX 路径
 * @param rootPath 项目根目录 (绝对路径)
 * @param filePath 目标文件 (绝对路径)
 */
export function getRelativePosixPath(rootPath: string, filePath: string): string {
  // 1. 先计算相对路径 (此时可能包含 win32 分隔符)
  const relativePath = path.relative(rootPath, filePath);

  // 2. 再标准化为 POSIX
  return toPosixPath(relativePath);
}
