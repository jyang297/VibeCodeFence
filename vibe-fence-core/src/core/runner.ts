// src/core/runner.ts
import { scanShadowTokens } from './histogram'; // 假设你之前合并到了这里
import { scanComponents } from './scanner';
import { FenceContext } from '../types';
import path from 'path';

/**
 * 核心运行逻辑：不依赖 CLI 环境，纯函数
 * 输入：项目根目录路径
 * 输出：完整的 FenceContext 对象
 */
export async function generateFenceContext(rootPath: string): Promise<FenceContext> {
  // 1. 并行执行扫描
  const [tokens, components] = await Promise.all([
    scanShadowTokens(rootPath),
    scanComponents(rootPath)
  ]);

  const shadowTokenCount = tokens.filter(t => t.source === 'scan').length;

  // 2. 构建数据
  const context: FenceContext = {
    schemaVersion: "0.2.1",
    generatedAt: new Date().toISOString(), // 注意：测试时这可能导致快照不匹配，稍后处理
    contentHash: `hash-${components.length}-${tokens.length}`, // 简化的 Hash
    projectInfo: {
      name: path.basename(rootPath)
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
