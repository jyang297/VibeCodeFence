import { Project, ts, CompilerOptions } from 'ts-morph';
import path from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';
import { ComponentMeta } from '../types';
import { extractComponentInfo } from './ast-parser';

/**
 * 组件扫描器
 * 专注于 AST 解析，提取结构化组件信息
 */
export async function scanComponents(files: string[], root: string): Promise<ComponentMeta[]> {
  if (files.length === 0) return [];

  // 1. Context-Aware Config Loading
  const firstFileDir = path.dirname(files[0]);
  const tsConfigPath = await findUp('tsconfig.json', firstFileDir, root);

  let compilerOptions: CompilerOptions = {
    allowJs: true,
    target: ts.ScriptTarget.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    noResolve: true, 
    skipLibCheck: true,
    jsx: ts.JsxEmit.React,
  };

  if (tsConfigPath) {
    console.log(chalk.blue(`   📘 Loaded CompilerOptions from: ${path.relative(root, tsConfigPath)}`));
    const tempProject = new Project({ tsConfigFilePath: tsConfigPath, skipAddingFilesFromTsConfig: true });
    // 合并配置，但保持鲁棒性覆盖
    Object.assign(compilerOptions, tempProject.getCompilerOptions(), {
       noResolve: true, 
       skipLibCheck: true
    });
  }

  // 2. Init Project
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: compilerOptions
  });

  // 3. Load Files
  files.forEach(file => project.addSourceFileAtPath(file));

  // 4. Parse & Extract
  const components: ComponentMeta[] = [];
  
  for (const sourceFile of project.getSourceFiles()) {
     try {
       // extractComponentInfo 现在会返回 name, filePath, fingerprint 等
       const extracted = extractComponentInfo(sourceFile);
       if(extracted) {
         // 这里我们可以做一步相对路径转换，让 Context 里的路径更干净
         extracted.filePath = path.relative(root, extracted.filePath);
         components.push(extracted);
       }
     } catch(e) {
       // Skip failed files
     }
  }

  return components;
}

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