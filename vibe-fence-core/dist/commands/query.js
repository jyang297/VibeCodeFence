"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryCommand = void 0;
// src/commands/query.ts
const commander_1 = require("commander");
const runner_1 = require("../core/runner");
const zod_1 = require("zod");
// 1. 定义防御性 Schema (Defensive Schemas)
// 确保 AI 传进来的参数符合预期，否则报错
const GetComponentSchema = zod_1.z.object({
    componentName: zod_1.z.string().min(1, "Component name is required"),
});
// 通用参数解析器，处理可能不合法的 JSON 字符串
const parseArgs = (jsonStr) => {
    try {
        return JSON.parse(jsonStr);
    }
    catch (e) {
        throw new Error(`Invalid JSON arguments: ${jsonStr}`);
    }
};
exports.queryCommand = new commander_1.Command('query')
    .description('Universal machine-readable JSON interface for AI Agents')
    .requiredOption('-t, --tool <name>', 'Tool name (e.g., get_profile, get_component)')
    .option('-a, --args <json>', 'JSON arguments string', '{}') // 默认为空对象
    .action(async (options) => {
    try {
        // --- A. 参数解析层 ---
        const args = parseArgs(options.args);
        const toolName = options.tool;
        // --- B. 核心逻辑层 (Core Logic) ---
        // ⚠️ 关键：generateFenceContext 内部可能会有 console.log
        // 如果 core/runner 里的代码不够"静默"，我们需要在这里劫持 stdout，或者确保 runner 只打 stderr
        // 假设我们之前设计的 runner 是"干净"的，或者只在 CLI 层 (index.ts) 打印日志。
        const context = await (0, runner_1.generateFenceContext)(process.cwd());
        let result;
        // --- C. 路由层 (Router) ---
        switch (toolName) {
            case 'get_profile':
                // 场景: Agent 刚启动，需要一个 Global Summary
                // 我们不返回几千行的完整 context，只提取 AI 最需要的信息
                result = {
                    project: context.projectInfo.name,
                    stats: context.stats,
                    // 核心 Token: 只给 AI 看 Top 15，并带上 usedBy (反向索引)
                    // 这样 AI 一眼就知道 "红色(#ef4444)" 是用来做 "DeleteBtn" 的
                    key_tokens: context.tokens
                        .slice(0, 15)
                        .map(t => ({
                        type: t.type,
                        value: t.value,
                        source: t.source,
                        usedBy: t.usedBy // 🌟 关键信息
                    })),
                    // 组件名列表，方便 AI 知道有哪些组件可查
                    available_components: context.components.map(c => c.name)
                };
                break;
            case 'get_component':
                // 场景: Agent 需要编写或修改特定组件，查询详细指纹
                const { componentName } = GetComponentSchema.parse(args);
                const component = context.components.find(c => c.name === componentName);
                if (!component) {
                    // 优雅降级：不要抛错让进程挂掉，而是返回一个 AI 能读懂的错误对象
                    result = {
                        error: true,
                        message: `Component '${componentName}' not found. Please check 'available_components' list.`
                    };
                }
                else {
                    result = component;
                }
                break;
            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }
        // --- D. 输出层 (The Only Output) ---
        // 🌟 整个执行过程中，这是唯一一行写到 STDOUT 的代码
        console.log(JSON.stringify(result, null, 2));
    }
    catch (error) {
        // --- E. 错误处理层 ---
        // 即使出错，也要返回 JSON，这样 Agent 才能知道是参数错了还是系统挂了
        const errorResponse = {
            status: "error",
            message: error instanceof Error ? error.message : "Unknown error",
            // 如果是 Zod 校验错误，提供更详细的信息
            details: error instanceof zod_1.z.ZodError ? error.issues : undefined
        };
        // 依然输出到 STDOUT，因为 Agent 此时在等待 JSON 回复
        console.log(JSON.stringify(errorResponse, null, 2));
        // 退出码 1，便于脚本检测失败 (可选)
        process.exit(1);
    }
});
