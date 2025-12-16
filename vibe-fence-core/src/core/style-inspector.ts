import fs from 'fs-extra';
import path from 'path';
import { TokenMeta, InspectorConfig } from '../types';

interface ScanRule {
  id: string;
  type: TokenMeta['type'];
  regex: RegExp;
  captureGroup?: number; // 0 for full match, 1 for first group
}

// 默认规则集 (内置规则)
const BUILTIN_RULES: ScanRule[] = [
  {
    id: 'hex-color',
    type: 'color',
    // 匹配 #FFF 或 #FFFFFF，且后面不是 hex 字符 (防止截断)
    regex: /#(?:[0-9a-fA-F]{3}){1,2}\b/g
  },
  {
    id: 'tailwind-arbitrary-color',
    type: 'color',
    // 匹配 bg-[#fff]
    regex: /(?:bg|text|border|ring|fill|stroke)-+\[(#(?:[0-9a-fA-F]{3}){1,2})\]/g,
    captureGroup: 1
  }
];

/**
 * 样式检查器 (Style Inspector)
 * 负责基于正则规则扫描全局样式 Token
 */
export async function inspectStyles(
  files: string[], 
  root: string, 
  config?: InspectorConfig
): Promise<TokenMeta[]> {
  
  const tokenMap = new Map<string, TokenMeta>();
  
  // 1. 组装规则 (可扩展：未来这里可以合并 config.customRules)
  const activeRules = [...BUILTIN_RULES];
  
  // 如果用户在 config 里关掉了颜色扫描 (虽然不太可能)，可以 filter 掉
  // if (config?.colors === false) { ... }

  // 2. 并行扫描
  await Promise.all(files.map(async (file) => {
    try {
      const content = await fs.readFile(file, 'utf-8');
      const relativePath = path.relative(root, file);

      // 对每个文件应用所有规则
      for (const rule of activeRules) {
        applyRule(content, rule, relativePath, tokenMap);
      }
    } catch (e) {
      // ignore read errors
    }
  }));

  // 3. 输出结果
  return Array.from(tokenMap.values()).sort((a, b) => b.count - a.count);
}

/**
 * 应用单个规则并记录 Token
 */
function applyRule(
  content: string, 
  rule: ScanRule, 
  filePath: string, 
  map: Map<string, TokenMeta>
) {
  const { regex, captureGroup = 0, type } = rule;
  regex.lastIndex = 0; // 重置正则状态

  let match;
  while ((match = regex.exec(content)) !== null) {
    const rawValue = match[captureGroup];
    if (!rawValue) continue;
    
    const value = rawValue.toLowerCase(); // 归一化

    if (!map.has(value)) {
      map.set(value, {
        type,
        value,
        count: 0,
        usedBy: [],
        source: 'scan' // 目前只要是扫描出来的都算 Shadow，除非未来引入 Design Token 对比
      });
    }

    const token = map.get(value)!;
    
    // 更新统计
    recordTokenUsage(token, filePath);
  }
}

/**
 * 记录 Token 使用情况 (双向链接的基础)
 */
function recordTokenUsage(token: TokenMeta, usageContext: string) {
  token.count++;
  // 记录 File Path 作为引用来源
  // TODO Phase 2: 如果能传入 AST 上下文，这里可以记录 "File::ComponentName"
  if (!token.usedBy.includes(usageContext)) {
    token.usedBy.push(usageContext);
  }
}