// @ts-check
'use strict'

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const platform = os.platform();
const arch = os.arch();

const releasesDir = path.join(__dirname, '../Releases');

if (!fs.existsSync(releasesDir)) {
	fs.mkdirSync(releasesDir, { recursive: true });
}

console.log('Building standalone executable with Bun...');
console.log(`Current platform: ${platform} (${arch})`);

// Build executable for current platform directly from TypeScript
const outputName = platform === 'win32' 
	? 'modbussimulator-win-x64.exe'
	: platform === 'linux'
	? 'modbussimulator-linux-x64'
	: 'modbussimulator';

console.log('Compiling with Bun (TypeScript input)...');
// Use the current Bun runtime path to avoid PATH issues
const bunRuntime = process.execPath;

const build = spawnSync(bunRuntime, [
	'build',
	'ModbusSimulator.ts',
	'--compile',
	'--outfile', path.join(releasesDir, outputName),
	'--external', 'serialport'
], {
	cwd: path.join(__dirname, '..'),
	stdio: 'inherit'
});

if (build.status !== 0) {
	console.error('Build failed');
	process.exit(1);
}

console.log(`✓ Executable created: ${outputName}`);

// Copy schema files
const schemas = ['schema_appconfig', 'schema_datas', 'schema_data', 'schema_coils', 'schema_registers'];
for (const schema of schemas) {
	const src = path.join(__dirname, `../schemas/${schema}.json`);
	const dst = path.join(releasesDir, `${schema}.json`);
	if (fs.existsSync(src)) {
		fs.copyFileSync(src, dst);
	}
}

// Externalized native dependency: bundle node_modules/serialport alongside the executable
const serialportSrc = path.join(__dirname, '../node_modules/serialport');
const serialportDst = path.join(releasesDir, 'node_modules/serialport');
if (fs.existsSync(serialportSrc)) {
	fs.mkdirSync(path.dirname(serialportDst), { recursive: true });
	fs.cpSync(serialportSrc, serialportDst, { recursive: true });
}

console.log('');
console.log('✓ Build complete! Standalone executable is in the Releases directory.');
console.log('');
console.log('To use this executable:');
if (platform === 'win32') {
	console.log(`  ${outputName} <config-file>`);
} else {
	console.log(`  ./${outputName} <config-file>`);
}
console.log('');
console.log('Note: For cross-platform builds, run this build script on each target platform.');
