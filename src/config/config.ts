// @ts-nocheck
'use strict';

import { isAbsolute, resolve, join, parse, relative, sep, dirname as pathDirname } from 'path';
import { fileURLToPath } from 'url';
import json5 from 'json5';
const { parse: _parse } = json5;
import { readFileSync } from 'fs';

const __dirname = pathDirname(fileURLToPath(import.meta.url));

// Custom function to resolve JSON references
async function resolveJsonReferences(obj, basePath, resolvedDocs = {}) {
  // If it's a $ref string, resolve it
  if (typeof obj === 'object' && obj !== null && '$ref' in obj && !Array.isArray(obj)) {
    const refValue = obj['$ref'];
    
    if (typeof refValue === 'string') {
      // Internal reference (e.g., "#/data/DI")
      if (refValue.startsWith('#/')) {
        const path = refValue.substring(2).split('/');
        let target = resolvedDocs[basePath];
        for (const key of path) {
          target = target?.[key];
        }
        if (target !== undefined) {
          return await resolveJsonReferences(target, basePath, resolvedDocs);
        }
      }
      // External reference (e.g., "./inputs_e2e.json")
      else {
        const refPath = isAbsolute(refValue) ? refValue : join(pathDirname(basePath), refValue);
        if (!resolvedDocs[refPath]) {
          const refData = readFileSync(refPath, 'utf8');
          resolvedDocs[refPath] = _parse(refData);
        }
        return await resolveJsonReferences(resolvedDocs[refPath], refPath, resolvedDocs);
      }
    }
  }
  
  // Recursively resolve references in nested objects and arrays
  if (typeof obj === 'object' && obj !== null) {
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        obj[i] = await resolveJsonReferences(obj[i], basePath, resolvedDocs);
      }
    } else {
      for (const key of Object.keys(obj)) {
        obj[key] = await resolveJsonReferences(obj[key], basePath, resolvedDocs);
      }
    }
  }
  
  return obj;
}

const readJson = async function(/** @type {string} */ jsonpath){
  const resolvedPath = isAbsolute(jsonpath) ? jsonpath : resolve(jsonpath);
  const data = readFileSync(resolvedPath);
  
  const json = _parse(data.toString());
  
  // Resolve all $ref values recursively
  const resolvedDocs = { [resolvedPath]: json };
  const resolved = await resolveJsonReferences(json, resolvedPath, resolvedDocs);
  
  return resolved;
};

const BUN_ROOT = '~BUN';

// Get the root directory (parent of src/config)
const rootDir = join(__dirname, '../../');

let configfile = './appconfig.json';
if (process.argv.length > 2 && typeof process.argv[2] === 'string' && process.argv[2].trim()) {
  const arg = process.argv[2];
  // Filter out invalid arguments (like '{}', '[object Object]', test files, etc.)
  if (!arg.includes('{') && !arg.includes('}') && arg.length > 0 && !arg.endsWith('.ts') && !arg.endsWith('.js')) {
    if (arg.startsWith('./')){
      configfile = arg;
    } else {
      configfile = './'+arg;
    }
  }
}

const runInBun = (function() {
  const pathParsed = parse(__dirname);
  const root = pathParsed.root;
  const dir = pathParsed.dir;
  const firstDepth = relative(root, dir).split(sep)[0];
  return (firstDepth === BUN_ROOT || root.includes('BUN'));
})();

let config = null;

// Use default config for test environment
const loadConfig = async () => {
  if (process.env.NODE_ENV === 'test') {
    return await readJson(join(__dirname, 'default-config.json'));
  } else {
    try {
      if (runInBun) {
        // For compiled Bun executables, resolve config relative to current working directory
        const configPath = isAbsolute(configfile) ? configfile : resolve(process.cwd(), configfile);
        return await readJson(configPath);
      } else {
        return await readJson(join(rootDir, configfile));
      }
    } catch (error) {
      // If config file not found, try to load from src/config directory (for tests)
      if (error.code === 'ENOENT') {
        try {
          return await readJson(join(__dirname, 'appconfig.json'));
        } catch (innerError) {
          // Fail gracefully with informative error message
          console.error('==================================================');
          console.error('ERROR: Configuration file not found');
          console.error('==================================================');
          console.error(`Attempted to load: ${configfile}`);
          console.error(`Current directory: ${process.cwd()}`);
          console.error(`Also tried: ${join(__dirname, 'appconfig.json')}`);
          console.error('');
          console.error('Please provide a valid configuration file path as an argument:');
          console.error('  modbussimulator-win-x64.exe path/to/appconfig.json');
          console.error('  or: bun ModbusSimulator.ts path/to/appconfig.json');
          console.error('');
          console.error('Or create a default appconfig.json in the current directory.');
          console.error('==================================================');
          process.exit(1);
        }
      } else {
        throw error;
      }
    }
  }
};

// Load config asynchronously
config = await loadConfig();

// Override config name and device_id if NAME environment variable is set, usefull for launching multiple instances of the same config
if (typeof process.env.NAME === 'string') {
  config.name = process.env.NAME;
  config.device_id = process.env.NAME;
}

export default {
  runInBun,
  config
};

export { runInBun, config };
