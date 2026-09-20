import {readFile} from 'node:fs/promises';
import {validateConfig} from './config.js';
const [command,configPath] = process.argv.slice(2);
if (command !== 'config-check' || !configPath || process.argv.length !== 4) {
  console.error('Usage: node dist/cli.js config-check CONFIG_PATH');
  process.exitCode = 2;
} else {
  try {
    const config = validateConfig(JSON.parse(await readFile(configPath,'utf8')));
    console.log(JSON.stringify({valid:true,projects:config.projects.map(p => p.id),executionStarted:false}));
  } catch (error) {
    const message = error instanceof Error && error.message.startsWith('Invalid configuration:') ? error.message : 'Invalid configuration: file is missing, unreadable or invalid JSON';
    console.error(message);
    process.exitCode = 1;
  }
}
