// src/core/ast-parser.ts
import { SourceFile, SyntaxKind, Node } from 'ts-morph';
import { ComponentMeta, PropItem } from '../types';

export function extractComponentInfo(sourceFile: SourceFile): ComponentMeta | null {
  const filePath = sourceFile.getFilePath(); // 🌟 获取文件路径

  // 1. 尝试找到 Export 的函数声明
  const exportFunc = sourceFile.getFunctions().find(f => f.isExported());
  
  if (exportFunc) {
    const name = exportFunc.getName();
    // 简单的约定：首字母大写视为组件
    if (name && /^[A-Z]/.test(name)) { 
      const isDefault = exportFunc.isDefaultExport(); // 🌟 判断导出类型
      return {
        name,
        filePath, // ✅ 补全
        exportType: isDefault ? 'default' : 'named', // ✅ 补全
        props: extractPropsFromFunction(exportFunc),
        skeleton: sanitizeSkeleton(exportFunc.getText()),
        fingerprint: { colors: [], spacings: [] }
      };
    }
  }

  // 2. 尝试找到 Export 的 Const 箭头函数
  const variableStmts = sourceFile.getVariableStatements();
  for (const stmt of variableStmts) {
    if (stmt.isExported()) {
      const decl = stmt.getDeclarations()[0];
      const name = decl.getName();
      const initializer = decl.getInitializer();

      if (name && /^[A-Z]/.test(name) && initializer && Node.isArrowFunction(initializer)) {
        // VariableStatement 本身不能是 default export (除非只有声明)，通常是 named
        // 复杂的 default export const ... 需要更细致判断，这里简化处理
        return {
          name,
          filePath, // ✅ 补全
          exportType: 'named', // ✅ 补全
          props: extractPropsFromArrowFunc(initializer),
          skeleton: initializer.getText()
            .replace(/=>\s*\([\s\S]*?\)/g, '=> (<ImplementationHidden />)')
            .replace(/=>\s*<[\s\S]*?$/g, '=> <ImplementationHidden />'),
          fingerprint: { colors: [], spacings: [] }
        };
      }
    }
  }

  return null;
}

// --- Props 提取辅助函数 (保持不变) ---
function extractPropsFromFunction(func: any): PropItem[] {
  const params = func.getParameters();
  if (params.length === 0) return [];

  const propsParam = params[0];
  const props: PropItem[] = [];

  const objectBinding = propsParam.getNameNode();
  if (Node.isObjectBindingPattern(objectBinding)) {
    objectBinding.getElements().forEach((el: any) => {
      props.push({
        name: el.getName(),
        type: 'unknown',
        required: true
      });
    });
  } else {
    const typeNode = propsParam.getTypeNode();
    if (typeNode) {
        props.push({ name: 'props', type: typeNode.getText(), required: true });
    }
  }
  return props;
}

function extractPropsFromArrowFunc(arrowFunc: any): PropItem[] {
    return extractPropsFromFunction(arrowFunc);
}

function sanitizeSkeleton(code: string): string {
  // 策略：不尝试精确匹配 return 里的 JSX，而是把整个函数体核心替换掉
  // 但为了保留 Props 定义，这比较难。
  
  // 改进的正则策略：
  // 1. 先匹配 return (...); 的形式
  // 2. 如果没匹配到，再匹配 return <...>; 的形式
  // 3. 使用非贪婪匹配，防止吃掉太多
  
  let cleaned = code;
  
  // 匹配 return ( ... ); 
  // [\s\S]*? 是非贪婪匹配所有字符
  const returnParenRegex = /return\s*\([\s\S]*?\);?/g;
  
  if (returnParenRegex.test(cleaned)) {
     cleaned = cleaned.replace(returnParenRegex, 'return <ImplementationHidden />;');
  } else {
     // 只有当上面没匹配时，才尝试匹配直接返回 JSX 的情况 return <div...
     const returnJsxRegex = /return\s*<[\s\S]*?;?/g;
     cleaned = cleaned.replace(returnJsxRegex, 'return <ImplementationHidden />;');
  }

  return cleaned;
}