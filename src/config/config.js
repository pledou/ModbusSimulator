// @ts-check
'use strict';

const { isAbsolute, resolve, join, parse, relative, sep, dirname } = require('path');
const JsonRef = require('json-ref-lite');
const json5 = require('json5');
const { parse: _parse } = json5;
const { readFileSync } = require('fs');

const readJson = function(/** @type {string} */ jsonpath){
  const resolvedPath = isAbsolute(jsonpath) ? jsonpath : resolve(jsonpath);
  const data = readFileSync(resolvedPath);
  
  // Save current working directory
  const originalCwd = process.cwd();
  
  try {
    // Change to the directory of the JSON file to resolve relative $refs correctly
    process.chdir(dirname(resolvedPath));
    
    const resolver = new JsonRef();
    return resolver.resolve(_parse(data.toString()));
  } finally {
    // Restore original working directory
    process.chdir(originalCwd);
  }
};

const PKG_TOP_DIR = 'snapshot';

// Get the root directory (parent of src/config)
const rootDir = join(__dirname, '../../');

let configfile = './appconfig.json';
if (process.argv.length > 2 && typeof process.argv[2] === 'string' && process.argv[2].trim()) {
  const arg = process.argv[2];
  // Filter out invalid arguments (like '{}', '[object Object]', etc.)
  if (!arg.includes('{') && !arg.includes('}') && arg.length > 0) {
    if (arg.startsWith('./')){
      configfile = arg;
    } else {
      configfile = './'+arg;
    }
  }
}

const runInPKG = (function() {
  const pathParsed = parse(__dirname);
  const root = pathParsed.root;
  const dir = pathParsed.dir;
  const firstDepth = relative(root, dir).split(sep)[0];
  return (firstDepth === PKG_TOP_DIR);
})();

let config = null;
try {
  if (runInPKG) {
    const deployPath = dirname(process.execPath);
    config = readJson(join(deployPath, configfile));
  }else{
    config = readJson(join(rootDir, configfile));
  }
} catch (error) {
  // If config file not found, try to load from src/config directory (for tests)
  if (error.code === 'ENOENT') {
    try {
      config = readJson(join(__dirname, 'appconfig.json'));
    } catch (innerError) {
      // Fail gracefully with informative error message
      console.error('==================================================');
      console.error('ERROR: Configuration file not found');
      console.error('==================================================');
      console.error(`Attempted to load: ${configfile}`);
      console.error(`Root directory: ${rootDir}`);
      console.error(`Also tried: ${join(__dirname, 'appconfig.json')}`);
      console.error('');
      console.error('Please provide a valid configuration file path as an argument:');
      console.error('  node ModbusSimulator.js path/to/appconfig.json');
      console.error('');
      console.error('Or create a default appconfig.json in the root directory.');
      console.error('==================================================');
      process.exit(1);
    }
  } else {
    throw error;
  }
}

// Override config name and device_id if NAME environment variable is set, usefull for launching multiple instances of the same config
if (typeof process.env.NAME === 'string') {
  config.name = process.env.NAME;
  config.device_id = process.env.NAME;
}

module.exports = {
  runInPKG,
  config,
  default: { runInPKG, config }
};
