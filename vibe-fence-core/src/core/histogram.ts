// src/core/histogram.ts
import { glob } from 'fast-glob';
import path from 'path';
import fs from 'fs-extra';
import { colord, extend } from 'colord';
import namesPlugin from 'colord/plugins/names';
import { TokenMeta, TokenType, FenceConfig } from '@/types';

extend([namesPlugin]);

const HEX_COLOR_REGEX = /#(?:[0-9a-fA-F]{3}){1,2}(?![0-9a-fA-F])/g;

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
export async function scanShadowTokens(root: string): Promise<TokenMeta[]> {
  // 1. 🌟 新增: 读取 Config (复用 scanner 的逻辑)
  const configPath = path.join(root, '.fence/fence.config.json');
  let includePatterns = ['src/**/*.{ts,tsx,js,jsx}'];
  let excludePatterns = ['**/node_modules/**'];

  if (await fs.pathExists(configPath)) {
    try {
      const config: FenceConfig = await fs.readJSON(configPath);
      if (config.scan?.include) includePatterns = config.scan.include;
      if (config.scan?.exclude) excludePatterns = config.scan.exclude;
    } catch (e) {
      // ignore config error
    }
  }

  // 2. 🌟 修改: 使用 Config 中的路径
  const files = await glob(includePatterns, {
    cwd: root,
    absolute: true,
    ignore: excludePatterns,
    // 允许扫描 . 开头的目录 (如 .storybook 等，如果用户include了)
    dot: true 
  });

  const tokenMap = new Map<string, TokenMeta>();

  // 3. 遍历文件 (逻辑保持不变)
  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8');
    
    // ... 原有的 extractTokensFromText 逻辑 ...
    extractTokensFromText(content, 'color', HEX_COLOR_REGEX, file, tokenMap);
    // extractTokensFromText(content, 'spacing', TAILWIND_SPACING_REGEX, file, tokenMap); // 如果你有这个
  }

  // 转换 Map 到 Array
  return Array.from(tokenMap.values()).sort((a, b) => b.count - a.count);
}

// ... extractTokensFromText 保持不变 ...
function extractTokensFromText(
  content: string, 
  type: 'color' | 'spacing', 
  regex: RegExp, 
  file: string, 
  map: Map<string, TokenMeta>
) {
  let match;
  while ((match = regex.exec(content)) !== null) {
    const value = match[0].toLowerCase(); // 归一化
    const relativePath = path.basename(file); // 简化路径记录

    if (!map.has(value)) {
      map.set(value, { 
        type, 
        value, 
        count: 0, 
        usedBy: [],
        source: 'scan' 
      });
    }

    const token = map.get(value)!;
    token.count++;
    if (!token.usedBy?.includes(relativePath)) {
      token.usedBy?.push(relativePath);
    }
  }
}