// src/types.ts

/**
 * TeamVibeFence Type Definitions v0.2.0
 * SSOT (Single Source of Truth) for AI Context Injection
 */

export type ImportType = 'named' | 'default';
export type TokenType = 
  | 'color' 
  | 'spacing'    // e.g. p-4, 16px, 1rem
  | 'radius'     // e.g. rounded-lg, 8px
  | 'typography' // e.g. text-xl, font-bold
  | 'shadow'     // e.g. shadow-md
  | 'unknown';
export type TokenSource = 'scan' | 'config'; // scan=代码中发现, config=配置文件读取
export type FenceProfile = 'local' | 'shared';

export interface ComponentProp {
  name: string;
  type: string;          // 原始类型定义 e.g. "string | number"
  required: boolean;
  defaultValue?: string; // 默认值，减少 AI 幻觉
  description: string;   // JSDoc 注释，AI 理解意图的关键
}

export interface ComponentMeta {
  name: string;          
  filePath: string;      // 相对路径 e.g. "src/components/Button.tsx"
  exportType: ImportType;// 指导 AI 生成正确的 import 语句
  props: ComponentProp[];
  skeleton: string;      // 脱敏后的代码骨架 (Sanitized Skeleton)
}

export interface TokenMeta {
  type: TokenType;
  value: string;         // e.g. "#2563EB"
  count: number;         // 出现频次
  source: TokenSource;   // 'config' = predefined, 'scan'=something new
  inferredName?: string; // 预留: 如果推断出语义名(e.g. "primary")存这里
}

export interface FenceContext {
  schemaVersion: string; // Schema 版本，防止解析错误
  generatedAt: string;   // 生成时间 仅应用于本地Debug CI/Git 比较的时候应该忽略
  contentHash: string;  // Stable Hash: Only when components or tokens 实质内容发生变化才变更 防止时间戳变了内容没变导致git冲突
  
  projectInfo: {
    name: string;        // package.json name
    version?: string;    // package.json version
  };

  stats: {
    componentCount: number;
    tokenCount: number;
    shadowTokenCount: number; // 监控指标: 多少个未定义的 Token
  };

  // 规范： Determinstic Sort 保证多人扫描一致
  tokens: TokenMeta[];
  components: ComponentMeta[];
}

export interface FenceConfig {
  profile: FenceProfile;
  strict: boolean; // 是否开启严格模式
  // 未来扩展: excludedPaths, customRules 等
}