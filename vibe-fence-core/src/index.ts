// src/index.ts
import { Command } from 'commander';
import chalk from 'chalk';

import { initCommand } from './commands/init';
import { scanCommand } from './commands/scan';
import { queryCommand } from './commands/query';
import { ejectCommand } from './commands/eject';
import { reportCommand } from './commands/report';

const program = new Command();

program
  .name('fence')
  .description('TeamVibeFence - AI Governance Middleware')
  .version('0.4.0');

program.addCommand(initCommand);
program.addCommand(scanCommand);
program.addCommand(queryCommand);
program.addCommand(ejectCommand);
program.addCommand(reportCommand);

// 错误处理：当用户输入未知命令时
program.on('command:*', () => {
  console.error(chalk.red('Invalid command: %s\n'), program.args.join(' '));
  console.log('See --help for a list of available commands.');
  process.exit(1);
});

program.parse(process.argv);