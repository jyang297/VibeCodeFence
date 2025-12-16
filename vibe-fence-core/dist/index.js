#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/index.ts
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const init_1 = require("./commands/init");
const scan_1 = require("./commands/scan");
const query_1 = require("./commands/query");
const eject_1 = require("./commands/eject");
const report_1 = require("./commands/report");
const program = new commander_1.Command();
program
    .name('fence')
    .description('TeamVibeFence - AI Governance Middleware')
    .version('0.4.0');
program.addCommand(init_1.initCommand);
program.addCommand(scan_1.scanCommand);
program.addCommand(query_1.queryCommand);
program.addCommand(eject_1.ejectCommand);
program.addCommand(report_1.reportCommand);
// 错误处理：当用户输入未知命令时
program.on('command:*', () => {
    console.error(chalk_1.default.red('Invalid command: %s\n'), program.args.join(' '));
    console.log('See --help for a list of available commands.');
    process.exit(1);
});
program.parse(process.argv);
