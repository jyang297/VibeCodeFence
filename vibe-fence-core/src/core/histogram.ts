// src/core/histogram.ts
import fg from 'fast-glob';
import fs from 'fs-extra';
import { colord, extend } from 'colord';
import namesPlugin from 'colord/plugins/names';
import { TokenMeta, TokenType } from '../types';

extend([namesPlugin]);

// --- 1. 定义探测器接口 (Detector Interface) ---
interface StyleDetector {
  type: TokenType;
  regex: RegExp;
  // 可选：归一化函数 (例如把 p-4 和 pt-4 都归为 spacing: 4)
  normalize?: (match: string) => string | null; 
}

// --- 2. 配置探测规则 (The Rules) ---
const DETECTORS: StyleDetector[] = [
  {
    type: 'color',
    // 匹配 Hex, RGB, RGBA
    regex: /#([0-9a-f]{3}){1,2}\b|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|rgba\([^)]+\)/gi,
    normalize: (val) => {
      const c = colord(val);
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
export async function scanShadowTokens(rootPath: string): Promise<TokenMeta[]> {
  // 存储结构: { 'color': { '#fff': 10 }, 'spacing': { 'p-4': 50 } }
  const stats: Record<string, Map<string, number>> = {};
  
  // 初始化 Map
  DETECTORS.forEach(d => stats[d.type] = new Map());

  const files = await fg([`${rootPath}/src/**/*.{tsx,jsx,css,scss,ts}`], { 
    ignore: ['**/node_modules/**', '**/.fence/**'] 
  });

  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8');

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
  const results: TokenMeta[] = [];

  Object.entries(stats).forEach(([type, map]) => {
    // 对每种类型，取 Top 10 (避免噪音太多)
    const topEntries = Array.from(map.entries())
      .sort((a, b) => b[1] - a[1]) // 降序
      .slice(0, 10); // 只取前10名
    
    topEntries.forEach(([value, count]) => {
      results.push({
        type: type as TokenType,
        value,
        count,
        source: 'scan'
      });
    });
  });

  // 全局再按频率排一次序，让高频的排前面
  return results.sort((a, b) => b.count - a.count);
}