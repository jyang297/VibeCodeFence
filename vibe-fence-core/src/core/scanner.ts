// src/core/scanner.ts
import { Project } from 'ts-morph';
import { ComponentMeta, ComponentProp } from '../types';
import { sanitizeComponent } from './sanitizer';
import path from 'path';

export async function scanComponents(rootPath: string): Promise<ComponentMeta[]> {
  const components: ComponentMeta[] = [];

  // 初始化 AST Project
  // skipAddingFilesFromTsConfig: true 提高速度，我们手动添加文件
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
  });

  // 假设组件都在 src/components (MVP 简化逻辑)
  // 生产环境可以读取 tsconfig 的 include 或 glob
  const globPattern = path.join(rootPath, 'src/components/**/*.{tsx,ts}');
  project.addSourceFilesAtPaths(globPattern);

  const sourceFiles = project.getSourceFiles();
  console.log(`AST Scanner: Analyzing ${sourceFiles.length} files...`);

  for (const sourceFile of sourceFiles) {
    // 查找所有导出的函数 (Function Declaration) 和 箭头函数 (Variable Declaration)
    // 这里简化处理：只抓取 Exported Function Declaration
    // 生产环境需要处理 const Button = ... 这种 Arrow Function
    const exportedFunctions = sourceFile.getFunctions().filter(f => f.isExported());

    // 同时抓取 Exported Variable Declarations (Arrow Functions)
    const exportedVariables = sourceFile.getVariableDeclarations().filter(v => v.isExported());

    // 合并处理
    const allNodes = [
      ...exportedFunctions,
      ...exportedVariables.map(v => v.getInitializerIfKind(require('ts-morph').SyntaxKind.ArrowFunction)).filter(Boolean)
    ];

    for (const node of allNodes) {
      if (!node) continue;

      // 获取组件名
      let name = '';
      if (Node.isFunctionDeclaration(node)) {
        name = node.getName() || '';
      } else if (Node.isArrowFunction(node)) {
        // 尝试向上找变量名
        const parent = node.getParent();
        if (Node.isVariableDeclaration(parent)) {
          name = parent.getName();
        }
      }

      // 简单过滤：只处理大写开头的 (React Component Convention)
      if (!name || !/^[A-Z]/.test(name)) continue;

      // 提取 Props (简化版)
      const props: ComponentProp[] = [];
      const params = node.getParameters();
      if (params.length > 0) {
        const propsParam = params[0];
        const type = propsParam.getType();

        type.getProperties().forEach(prop => {
          const decl = prop.getValueDeclaration();
          props.push({
            name: prop.getName(),
            type: decl?.getType().getText() || 'any',
            required: !prop.isOptional(),
            description: decl?.getJsDocs().map(doc => doc.getInnerText()).join('\n') || ''
          });
        });
      }

      // 🌟 调用核心脱敏逻辑
      const skeleton = sanitizeComponent(node as any);

      components.push({
        name,
        filePath: sourceFile.getFilePath(),
        props,
        skeleton
      });
    }
  }

  return components;
}
