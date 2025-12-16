// src/utils/file-loader.ts
import { glob } from 'fast-glob';
import path from 'path';
import fs from 'fs-extra';
import { FenceConfig } from '@/types';

export async function loadTargetFiles(root: string): Promise<string[]> {
  const configPath = path.join(root, '.fence/fence.config.json');
  
  let includePatterns = ['src/**/*.{ts,tsx,js,jsx}'];
  let excludePatterns = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'];

  if (await fs.pathExists(configPath)) {
    try {
      const config: FenceConfig = await fs.readJSON(configPath);
      
      if (config.scan?.include && config.scan.include.length > 0) {
        includePatterns = config.scan.include;
      }
      
      if (config.scan?.exclude) {
        excludePatterns = [...new Set([...excludePatterns, ...config.scan.exclude])];
      }
    } catch (e) {
      console.warn('⚠️ Failed to load config, falling back to defaults.');
    }
  }

  const files = await glob(includePatterns, {
    cwd: root,
    absolute: true,
    ignore: excludePatterns,
    dot: true 
  });

  return files;
}