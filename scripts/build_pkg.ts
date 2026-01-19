// @ts-check
'use strict'

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

(async () => {
	const { execa } = await import('execa');
	const { default: cpy } = await import('cpy');

	const { stdout } = await execa('pkg', ['..', '--out-path', '../Releases'], { cwd: __dirname });
	const lines = stdout.split(/[\r\n]+/);
	const addons: string[] = [];
	
	for (let i = 0; i < lines.length - 1; i++) {
		const line = lines[i]?.trim();
		const next = lines[i + 1]?.trim();
		
		if (
			line?.startsWith('The addon must be distributed') &&
			next?.endsWith('.node')
		) {
			addons.push(next.replace('%1: ', ''));
			i++; // Skip the next line since we've already processed it
		}
	}
	
	//Add externals:

	//json validation
	addons.push(path.join(__dirname, '../schemas/schema_appconfig.json'));
	addons.push(path.join(__dirname, '../schemas/schema_datas.json'));
	addons.push(path.join(__dirname, '../schemas/schema_data.json'));
	addons.push(path.join(__dirname, '../schemas/schema_coils.json'));
	addons.push(path.join(__dirname, '../schemas/schema_registers.json'));

	if (addons.length) {
		await cpy(addons, path.join(__dirname, '../Releases'));
	}
})().catch((e: any) => {
	console.error('Build failed with error:');
	console.error(e.message || e);
	if (e.stderr) console.error('STDERR:', e.stderr);
	if (e.stdout) {
		fs.writeFileSync('build-output.log', e.stdout, 'utf8');
		console.error('Full output written to build-output.log');
	}
	throw e;
});
