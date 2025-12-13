// tests/scanner.test.ts
import { scanComponents } from '../../src/core/scanner';
import path from 'path';
import fs from 'fs-extra';

describe('Smart Scanner', () => {
  const mockRoot = path.join(__dirname, 'fixtures');

  // 准备测试数据 (Fixtures)
  beforeAll(async () => {
    await fs.ensureDir(path.join(mockRoot, 'src/components'));
    await fs.writeFile(path.join(mockRoot, 'src/components/Button.tsx'), `
      import React from 'react';

      export type ButtonProps = {
        /** * The visual style of the button.
         * @default 'primary'
         */
        variant?: 'primary' | 'secondary' | 'danger';
        /** Is the button loading? */
        loading?: boolean;
      };

      /**
       * Standard interactive button.
       */
      export function Button(props: ButtonProps) {
        return <button>{props.variant}</button>;
      }
    `);
  });

  // 清理测试数据
  afterAll(async () => {
    await fs.remove(mockRoot);
  });

  test('should extract component metadata correctly', async () => {
    const components = await scanComponents(mockRoot);

    expect(components).toHaveLength(1);
    const btn = components[0];

    expect(btn.name).toBe('Button');
    expect(btn.filePath).toContain('src/components/Button.tsx');

    // 检查 Props 提取
    const variantProp = btn.props.find(p => p.name === 'variant');
    expect(variantProp).toBeDefined();
    expect(variantProp?.required).toBe(false); // optional
    expect(variantProp?.description).toContain('visual style');

    // 检查类型 (注意: ts-morph 提取的类型文本可能包含 import 等，这里做模糊匹配)
    expect(variantProp?.type).toMatch(/primary/);
  });
});
