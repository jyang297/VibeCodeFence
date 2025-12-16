/**
 * 属性定义
 * 用于描述组件接收的 Props 信息
 */
export interface PropItem {
  /** Prop 名称 (e.g. "variant") */
  name: string;
  /** Prop 类型定义 (e.g. "string | number") */
  type: string;
  /** 是否必填 */
  required: boolean;
  /** 默认值 (用于 AI 理解组件的默认行为) */
  defaultValue?: string;
  /** JSDoc 描述 (AI 理解意图的关键) */
  description?: string;
}

/**
 * 核心组件元数据 (The Atom of Vibe)
 * 描述一个 UI 组件的结构、风格和约束
 */
export interface ComponentMeta {
  /** 组件名 (e.g. "Button") */
  name: string;
  /** 文件物理路径 (作为唯一 ID 使用) */
  filePath: string;
  /** 导出类型 */
  exportType: 'default' | 'named';
  
  /** 组件接口定义 */
  props: PropItem[];
  
  /** * 磨砂玻璃处理后的代码骨架 (Frosted Glass Skeleton)
   * 保留了 JSX 结构、Tailwind 类名和逻辑流，但隐藏了具体的文本和业务逻辑
   */
  skeleton: string;

  /** 风格指纹与布局约束 */
  fingerprint: {
    /** 提取到的颜色值 (用于交叉验证) */
    colors: string[];
    /** 提取到的间距值 */
    spacings: string[];
    /** 样式组合模式 (e.g. "flex items-center p-4") */
    stylePatterns: string[];
    /** 布局约束 (防止 AI 破坏布局) */
    constraints: {
      /** 是否包含固定尺寸 (w-[100px]) */
      hasFixedDimensions: boolean;
      /** 是否是弹性布局 */
      isFlexOrGrid: boolean;
    };
  };
}

/**
 * Token 来源类型
 */
export type TokenSource = 'scan' | 'design-system';

/**
 * 样式 Token 定义
 */
export interface TokenMeta {
  /** Token 类型 */
  type: 'color' | 'spacing' | 'font' | 'radius' | 'shadow';
  /** 原始值 (e.g. "#ef4444", "p-4") */
  value: string;
  /** 出现次数 */
  count: number;
  /** * 引用来源列表
   * 目前记录的是 FilePath，未来可精确到 Component Name
   */
  usedBy: string[];
  /** 来源：扫描发现的(Shadow) 还是 设计系统定义的(Official) */
  source: TokenSource;
}

/**
 * 检查规则配置 (Inspector Rules)
 * 允许用户动态定义需要扫描什么
 */
export interface InspectorConfig {
  /** 是否启用颜色扫描 */
  colors?: boolean;
  /** 自定义正则规则 (e.g. 扫描特定的 magic number) */
  customRules?: Record<string, string>;
}

/**
 * Vibe Fence 用户配置
 */
export interface FenceConfig {
  profile: 'local' | 'shared';
  /** 扫描器配置 */
  scanner?: {
    maxTokenUsageInfo: number;
  };
  scan: {
    /** 包含路径 (Glob) */
    include: string[];
    /** 排除路径 (Glob) */
    exclude: string[];
  };
  /** 检查器模块配置 (Modular Inspectors) */
  inspectors?: InspectorConfig;
}

/**
 * 最终生成的上下文 (The Single Source of Truth)
 */
export interface FenceContext {
  schemaVersion: string;
  generatedAt: string;
  projectInfo: { name: string };
  stats: {
    componentCount: number;
    tokenCount: number;
    shadowTokenCount: number;
  };
  /** 全局 Token 表 (用于去重和统计) */
  tokens: TokenMeta[];
  /** 组件表 (包含组件内的局部指纹) */
  components: ComponentMeta[];
}

// 🌟 修复: 导出默认配置
export const DEFAULT_CONFIG: Partial<FenceConfig> = {
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