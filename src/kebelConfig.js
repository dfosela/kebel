import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const CONFIG_DIR = '.kebel';
const CONFIG_FILE = 'kebel.config.json';

export function configPath(cwd) {
  return path.join(cwd, CONFIG_DIR, CONFIG_FILE);
}

export async function loadConfig(cwd) {
  try {
    const raw = await readFile(configPath(cwd), 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function saveConfig(config, cwd) {
  await mkdir(path.join(cwd, CONFIG_DIR), { recursive: true });
  await writeFile(configPath(cwd), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}
