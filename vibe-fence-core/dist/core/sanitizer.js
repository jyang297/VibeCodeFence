"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeComponent = sanitizeComponent;
// src/core/sanitizer.ts
const ts_morph_1 = require("ts-morph");
/**
 * The Lobotomy Strategy:
 * 保留组件的“头部”（签名、Props、JSDoc），切除“前额叶”（业务逻辑）。
 * 并注入伪代码占位符，保持 AI 的语义理解。
 */
function sanitizeComponent(node) {
    // 1. Get function body 
    const body = node.getBody();
    if (!body) {
        return node.getText(); // 如果只有声明没有实现 (e.g. .d.ts)，直接返回
    }
    // 2. 准备占位符内容
    // 告诉 AI：这里有逻辑，但被隐藏了，不要瞎猜实现，只关注接口
    const skeletonBody = `
    {
      /* * 🔒 VIBE FENCE: Logic & Implementation Hidden 
       * AI Instruction: Focus ONLY on Props and usage context.
       */
      return <ImplementationHidden />;
    }
  `;
    // 3. 处理不同类型的函数体
    // 情况 A: 显式 Block { return ... }
    if (ts_morph_1.Node.isBlock(body)) {
        // 这是一个内存操作，不会修改硬盘上的文件
        // 我们只是临时替换 Text 来获取骨架字符串
        body.replaceWithText(skeletonBody);
    }
    // 情况 B: 隐式返回 (Implicit Return) e.g. const A = () => <div/>
    else {
        // 将隐式返回的表达式直接替换为 Block
        body.replaceWithText(skeletonBody);
    }
    // 4. 获取处理后的文本
    const sanitizedText = node.getText();
    // 注意：ts-morph 的修改是在内存中的 AST 上进行的。
    // 我们不需要撤销修改，因为我们不会调用 sourceFile.save()。
    // 这保证了用户硬盘上的源代码绝对安全。
    return sanitizedText;
}
