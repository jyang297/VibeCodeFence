import { generateFenceContext } from '@/core/runner';
import path from 'path';
import fs from 'fs-extra';

describe('Integration: Fence Runner', () => {
  // 创建一个临时的测试项目目录
  const tempRoot = path.join(__dirname, 'temp-integration-project');

  beforeAll(async () => {
    await fs.ensureDir(path.join(tempRoot, 'src/components'));
    
    // 1. 写入一个包含样式的组件
    await fs.writeFile(path.join(tempRoot, 'src/components/Alert.tsx'), `
      import React from 'react';
      
      export type AlertProps = {
        /** Type of the alert */
        type: 'success' | 'error';
      };

      // 这里有硬编码颜色 #EF4444 (Red)
      export const Alert = ({ type }: AlertProps) => {
        return <div style={{ color: '#EF4444' }}>Alert</div>;
      }
    `);

    // 2. 写入一个 CSS 文件模拟 Token
    await fs.writeFile(path.join(tempRoot, 'src/index.css'), `
      .btn { background-color: #2563EB; } /* Blue */
    `);
  });

  afterAll(async () => {
    // 测试完清理现场
    await fs.remove(tempRoot);
  });

  test('should Generate full context with components and tokens', async () => {
    const context = await generateFenceContext(tempRoot);

    // 断言 1: 基础结构
    expect(context.schemaVersion).toBe("0.2.1");
    expect(context.projectInfo.name).toBe("temp-integration-project");

    // 断言 2: 组件扫描
    expect(context.components).toHaveLength(1);
    expect(context.components[0].name).toBe("Alert");
    // 验证脱敏是否生效 (集成测试的双重保险)
    expect(context.components[0].skeleton).toContain('<ImplementationHidden />');

    // 断言 3: Token 发现 (Histogram 集成)
    // 应该发现 #EF4444 (Alert里) 和 #2563EB (CSS里)
    const redToken = context.tokens.find(t => t.value.toLowerCase() === '#ef4444');
    console.log(context.tokens.type);
    const blueToken = context.tokens.find(t => t.value.toLowerCase() === '#2563eb');
    
    expect(redToken).toBeDefined();
    expect(blueToken).toBeDefined();
    expect(redToken?.source).toBe('scan');
  });

  // Snapshot Testing (快照测试)
  // 锁定了输出结构。
  test('matches snapshot', async () => {
    const context = await generateFenceContext(tempRoot);
    
    // 移除动态字段 (generatedAt) 避免每次测试都失败
    const stableContext = { ...context, generatedAt: 'MOCK_DATE' };
    
    expect(stableContext).toMatchSnapshot();
  });
});