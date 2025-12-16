import { SourceFile, SyntaxKind, Node, FunctionDeclaration, ArrowFunction } from 'ts-morph';
import { ComponentMeta, PropItem } from '../types';

// 正则: 检测固定宽度/高度 (如 w-10, h-[40px], w-px)
// 排除 w-full, w-auto, w-screen 这种安全的
const RIGID_DIMENSION_REGEX = /\b(w|h)-(?!full|auto|screen|min|max|fit)\[?(\d+|px|rem)\]?/i;

// 正则: 检测弹性布局
const FLEX_GRID_REGEX = /\b(flex|grid)\b/i;

export function extractComponentInfo(sourceFile: SourceFile): ComponentMeta | null {
  const filePath = sourceFile.getFilePath();

  // 1. 尝试找到 Export 的函数声明 (function Component...)
  const exportFunc = sourceFile.getFunctions().find(f => f.isExported());
  
  if (exportFunc) {
    const name = exportFunc.getName();
    if (name && /^[A-Z]/.test(name)) { 
      // 🌟 应用磨砂玻璃效果 (直接修改内存 AST)
      applyFrostedGlass(exportFunc);
      
      // 🌟 提取指纹
      const fingerprint = analyzeStyleFingerprint(exportFunc);

      return {
        name,
        filePath,
        exportType: exportFunc.isDefaultExport() ? 'default' : 'named',
        props: extractPropsFromFunction(exportFunc),
        skeleton: exportFunc.getText(), // 获取的是脱敏后的代码
        fingerprint
      };
    }
  }

  // 2. 尝试找到 Export 的箭头函数 (const Component = ...)
  const variableStmts = sourceFile.getVariableStatements();
  for (const stmt of variableStmts) {
    if (stmt.isExported()) {
      const decl = stmt.getDeclarations()[0];
      const name = decl.getName();
      const initializer = decl.getInitializer();

      if (name && /^[A-Z]/.test(name) && initializer && Node.isArrowFunction(initializer)) {
        // 🌟 应用磨砂玻璃
        applyFrostedGlass(initializer);
        const fingerprint = analyzeStyleFingerprint(initializer);
        
        // 重新构造 const export 语句
        const skeleton = `export const ${name} = ${initializer.getText()};`;

        return {
          name,
          filePath,
          exportType: 'named',
          props: extractPropsFromArrowFunc(initializer),
          skeleton,
          fingerprint
        };
      }
    }
  }

  return null;
}

/**
 * 核心算法: 磨砂玻璃效果 (Semantic Masking)
 * 遮盖 JSX 文本内容，保留结构和属性
 */
function applyFrostedGlass(node: Node) {
  node.forEachDescendant((child) => {
    // 遮盖 JSX 文本: <div>Hello World</div> -> <div>...</div>
    if (Node.isJsxText(child)) {
      if (child.getText().trim().length > 0) {
        child.replaceWithText('...'); 
      }
    }
    // 遮盖注释
    if (child.getKind() === SyntaxKind.SingleLineCommentTrivia || 
        child.getKind() === SyntaxKind.MultiLineCommentTrivia) {
        child.replaceWithText('/* hidden */');
    }
  });
}

/**
 * 核心算法: 风格指纹与约束提取
 */
function analyzeStyleFingerprint(node: Node) {
  const styles = new Set<string>();
  let hasFixedDimensions = false;
  let isFlexOrGrid = false;

  node.forEachDescendant((child) => {
    if (Node.isJsxAttribute(child)) {
      const name = child.getNameNode().getText();
      if (name === 'className' || name === 'class') {
        const initializer = child.getInitializer();
        let classString = '';
        
        if (Node.isStringLiteral(initializer)) {
          classString = initializer.getLiteralValue();
        } else if (Node.isJsxExpression(initializer)) {
           const expr = initializer.getExpression();
           if (Node.isNoSubstitutionTemplateLiteral(expr)) {
             classString = expr.getLiteralValue();
           } else if (Node.isTemplateExpression(expr)) {
             classString = expr.getHead().getLiteralText();
           }
        }

        if (classString) {
           styles.add(classString.trim());
           if (RIGID_DIMENSION_REGEX.test(classString)) hasFixedDimensions = true;
           if (FLEX_GRID_REGEX.test(classString)) isFlexOrGrid = true;
        }
      }
    }
  });

  return {
    colors: [], 
    spacings: [],
    stylePatterns: Array.from(styles),
    constraints: {
      hasFixedDimensions,
      isFlexOrGrid
    }
  };
}

// --- Props Extraction Helpers ---

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
        required: true,
        description: undefined // 暂时不提取 JSDoc
      });
    });
  } else {
    const typeNode = propsParam.getTypeNode();
    if (typeNode) {
        props.push({ 
            name: 'props', 
            type: typeNode.getText(), 
            required: true 
        });
    }
  }
  return props;
}

function extractPropsFromArrowFunc(arrowFunc: any): PropItem[] {
    return extractPropsFromFunction(arrowFunc);
}