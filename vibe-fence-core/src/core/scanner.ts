import { glob } from 'fast-glob';
import path from 'path';
import fs from 'fs-extra';
// 1. 🌟 Fix: 引入 ts 命名空间，而不是直接引入 Enum
import { Project, ts, CompilerOptions } from 'ts-morph';
import chalk from 'chalk';
import { FenceConfig, ComponentMeta } from '../types';
// 2. 🌟 Fix: 确保这里引用的文件存在 (Step 2 会创建它)
import { extractComponentInfo } from '@/core/ast-parser'; 

export async function scanComponents(root: string): Promise<ComponentMeta[]> {
  // 1. 读取 Config
  const configPath = path.join(root, '.fence/fence.config.json');
  let includePatterns = ['src/**/*.{ts,tsx,js,jsx}'];
  let excludePatterns = ['**/node_modules/**'];

  if (await fs.pathExists(configPath)) {
    try {
      const config: FenceConfig = await fs.readJSON(configPath);
      if (config.scan?.include) includePatterns = config.scan.include;
      if (config.scan?.exclude) excludePatterns = config.scan.exclude;
    } catch (e) { console.warn('⚠️ Config error'); }
  }

  // 2. 找到所有目标文件
  const files = await glob(includePatterns, {
    cwd: root,
    absolute: true,
    ignore: excludePatterns,
    dot: true
  });

  if (files.length === 0) return [];

  // 3. 动态寻找 tsconfig
  const firstFileDir = path.dirname(files[0]);
  const tsConfigPath = await findUp('tsconfig.json', firstFileDir, root);

  // 4. 🌟 Fix: 使用 ts.ScriptTarget 等枚举
  let compilerOptions: CompilerOptions = {
    allowJs: true,
    target: ts.ScriptTarget.ESNext, 
    // 🌟 Fix: ModuleResolutionKind 才是给 moduleResolution 用的，ModuleKind 是给 module 用的
    moduleResolution: ts.ModuleResolutionKind.NodeNext, 
    noResolve: true,
    skipLibCheck: true,
    jsx: ts.JsxEmit.React,
  };

  if (tsConfigPath) {
    console.log(chalk.blue(`   📘 Loaded CompilerOptions from: ${path.relative(root, tsConfigPath)}`));
    const tempProject = new Project({ tsConfigFilePath: tsConfigPath, skipAddingFilesFromTsConfig: true });
    const loadedOptions = tempProject.getCompilerOptions();
    
    compilerOptions = {
      ...loadedOptions,
      noResolve: true,
      skipLibCheck: true
    };
  } else {
    console.log(chalk.yellow(`   ⚠️  No tsconfig.json found. Using loose mode defaults.`));
  }

  // 5. 初始化 Project
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: compilerOptions
  });

  files.forEach(file => project.addSourceFileAtPath(file));

  const components: ComponentMeta[] = [];
  for (const sourceFile of project.getSourceFiles()) {
     try {
       const extracted = extractComponentInfo(sourceFile);
       if(extracted) components.push(extracted);
     } catch(e) {}
  }

  return components;
}

// 辅助函数
async function findUp(filename: string, startDir: string, stopDir: string): Promise<string | null> {
  let current = startDir;
  while (current.startsWith(stopDir)) {
    const p = path.join(current, filename);
    if (await fs.pathExists(p)) return p;
    if (current === stopDir) break;
    current = path.dirname(current);
  }
  return null;
}