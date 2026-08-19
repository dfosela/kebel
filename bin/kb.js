#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runCli } from '../src/cli.js';

const pkgPath = fileURLToPath(new URL('../package.json', import.meta.url));
const { version } = JSON.parse(readFileSync(pkgPath, 'utf8'));
const binPath = fileURLToPath(import.meta.url);

const exitCode = await runCli(process.argv.slice(2), { version, stdout: process.stdout, binPath });
process.exit(exitCode);
