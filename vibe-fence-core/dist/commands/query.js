"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryCommand = void 0;
const commander_1 = require("commander");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const zod_1 = require("zod");
// 1. 定义防御性 Schema
const GetComponentSchema = zod_1.z.object({
    componentName: zod_1.z.string().min(1, "Component name is required"),
});
// 通用参数解析器
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
    .option('-a, --args <json>', 'JSON arguments string', '{}')
    .action(async (options) => {
    try {
        // --- A. Load Context (Fast Read) ---
        const root = process.cwd();
        const contextPath = path_1.default.join(root, '.fence/context.json');
        if (!fs_extra_1.default.existsSync(contextPath)) {
            throw new Error("Context not found. Please run 'fence scan' first.");
        }
        // 显式指定类型，解决隐式 any 问题
        const context = await fs_extra_1.default.readJSON(contextPath);
        // --- B. Parse Args ---
        const args = parseArgs(options.args);
        const toolName = options.tool;
        let result;
        // --- C. Router ---
        switch (toolName) {
            case 'get_profile':
                // 场景: Agent Global Summary
                result = {
                    project: context.projectInfo.name,
                    stats: context.stats,
                    // 核心 Token: Top 20
                    key_tokens: context.tokens
                        .slice(0, 20)
                        .map(t => ({
                        type: t.type,
                        value: t.value,
                        count: t.count,
                        source: t.source,
                        // 这里我们只返回 usedBy 的数量，或者前3个引用，防止 JSON 太大
                        usedBySample: t.usedBy.slice(0, 3)
                    })),
                    // 组件名列表
                    available_components: context.components.map(c => c.name)
                };
                break;
            case 'get_component':
                // 场景: Agent Query Component Details
                const { componentName } = GetComponentSchema.parse(args);
                const component = context.components.find(c => c.name === componentName);
                if (!component) {
                    result = {
                        error: true,
                        message: `Component '${componentName}' not found. Available: ${context.components.length} components.`
                    };
                }
                else {
                    result = component;
                }
                break;
            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }
        // --- D. Output ---
        console.log(JSON.stringify(result, null, 2));
    }
    catch (error) {
        // --- E. Error Handling ---
        const errorResponse = {
            status: "error",
            message: error instanceof Error ? error.message : "Unknown error",
            details: error instanceof zod_1.z.ZodError ? error.issues : undefined
        };
        console.log(JSON.stringify(errorResponse, null, 2));
        process.exit(1);
    }
});
