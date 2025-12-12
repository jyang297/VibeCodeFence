import { Project, Node, SyntaxKind, FunctionDeclaration, ArrowFunction } from 'ts-morph';
import { ComponentMeta, ComponentProp, StyleFingerprint, ImportType } from '../types';
import { sanitizeComponent } from './sanitizer';
import { getRelativePosixPath } from '../utils/path';
import { colord, extend } from 'colord';
import namesPlugin from 'colord/plugins/names';
import path from 'path';

extend([namesPlugin]);

// --- 指纹提取逻辑 ---
const REGEX_COLOR = /#([0-9a-f]{3}){1,2}\b|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|rgba\([^)]+\)/gi;
// 优化后的间距正则：捕获 p-4, m-2.5, gap-4, w-full 等
const REGEX_SPACING = /\b([pmWH][tbrlxy]?|gap(-[xy])?|space-[xy])-([0-9.]+|px|full|screen)\b/g;

function extractFingerprint(sourceText: string): StyleFingerprint {
  const colors = new Set<string>();
  const spacings = new Set<string>();

  const colorMatches = sourceText.match(REGEX_COLOR);
  if (colorMatches) {
    colorMatches.forEach(c => {
      const hex = colord(c).toHex();
      if (hex) colors.add(hex);
    });
  }

  const spacingMatches = sourceText.match(REGEX_SPACING);
  if (spacingMatches) {
    spacingMatches.forEach(s => spacings.add(s));
  }

  return {
    colors: Array.from(colors).slice(0, 10), // 限制数量，防止 JSON 爆炸
    spacings: Array.from(spacings).slice(0, 10)
  };
}

// --- 核心扫描逻辑 ---

export async function scanComponents(rootPath: string): Promise<ComponentMeta[]> {
  const components: ComponentMeta[] = [];
  
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
  });

  // 扩大扫描范围，包含 .jsx
  const globPattern = path.join(rootPath, 'src/components/**/*.{tsx,ts,jsx}');
  project.addSourceFilesAtPaths(globPattern);

  const sourceFiles = project.getSourceFiles();

  for (const sourceFile of sourceFiles) {
    // 1. 提取全文件指纹 (基于文本正则)
    const fingerprint = extractFingerprint(sourceFile.getFullText());

    // 2. 查找所有潜在组件节点
    // A. 显式函数声明: function Button() {}
    const functions = sourceFile.getFunctions();
    
    // B. 变量声明 (箭头函数): const Button = () => {}
    const variables = sourceFile.getVariableDeclarations();

    const allCandidates = [
        ...functions,
        ...variables
    ];

    for (const node of allCandidates) {
      // --- 核心修复 A: 智能名称与导出类型推断 ---
      const info = analyzeNode(node);
      if (!info) continue; // 不是组件或未导出，跳过

      const { name, exportType, logicNode } = info;

      // Heuristic: 组件名通常大写开头
      if (!/^[A-Z]/.test(name)) continue;

      // --- 提取 Props ---
      const props: ComponentProp[] = [];
      const params = logicNode.getParameters();
      
      if (params.length > 0) {
        const propsParam = params[0];
        const typeNode = propsParam.getType();
        
        // 防止 type 为 any 导致报错
        if (typeNode && typeNode.getText() !== 'any') {
            typeNode.getProperties().forEach(prop => {
                const decl = prop.getValueDeclaration();
                let description = '';
                if (decl && Node.isJSDocable(decl)) {
                  description = decl.getJsDocs()
                  .map(doc => doc.getInnerText())
                  .join('\n');
                }
                props.push({
                    name: prop.getName(),
                    type: decl?.getType().getText() || 'unknown',
                    required: !prop.isOptional(),
                    defaultValue: undefined,
                    description
                });
            });
        }
      }

      // --- 脱敏 ---
      const skeleton = sanitizeComponent(logicNode);

      components.push({
        name,
        filePath: getRelativePosixPath(rootPath, sourceFile.getFilePath()),
        exportType,
        props,
        skeleton,
        fingerprint
      });
    }
  }

  return components;
}

// --- 辅助：节点分析器 (解决箭头函数层级问题) ---
function analyzeNode(node: Node) {
  let name = '';
  let exportType: ImportType = 'named';
  let logicNode: FunctionDeclaration | ArrowFunction | undefined;

  // Case 1: Function Declaration
  if (Node.isFunctionDeclaration(node)) {
    if (!node.isExported() && !node.isDefaultExport()) return null;
    
    name = node.getName() || '';
    if (node.isDefaultExport()) {
        exportType = 'default';
        // 如果是 export default function() {} (没有名字)，尝试用文件名
        if (!name) {
            name = path.basename(node.getSourceFile().getFilePath(), path.extname(node.getSourceFile().getFilePath()));
        }
    }
    logicNode = node;
  } 
  
  // Case 2: Variable Declaration (const Button = ...)
  else if (Node.isVariableDeclaration(node)) {
    const variableStatement = node.getVariableStatement();
    if (!variableStatement || !variableStatement.isExported()) return null;

    name = node.getName();
    
    // 检查是否是 export default
    if (variableStatement.isDefaultExport()) {
        exportType = 'default';
    }

    // 获取初始化部分，看是不是箭头函数
    const initializer = node.getInitializer();
    if (Node.isArrowFunction(initializer)) {
        logicNode = initializer;
    } else {
        // 如果是 const Button = memo(...) 或者是 HOC，目前 MVP 暂不支持深层解析
        // 可以返回 null 跳过，或者以后在这里加 unwrapping 逻辑
        return null; 
    }
  }

  if (!logicNode || !name) return null;

  return { name, exportType, logicNode };
}