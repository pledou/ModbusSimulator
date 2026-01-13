// @ts-check
'use strict'

const execa = require('execa');
const cpy = require('cpy');
const path = require('path');
(async () =>{const {stdout} = await execa('pkg', ['..', '--out-path', '../Releases'], { shell: true, cwd: __dirname });
const lines = stdout.split(/[\r\n]+/);
const addons = [];
let i = 0;
while (i < lines.length - 1) {
	const [line, next] = lines.slice(i, i + 2).map(s => s && s.trim());
	i += 1;
	if (
		line && next &&
		line.startsWith('The addon must be distributed') &&
		next.endsWith('.node')
	) {
		addons.push(next.replace('%1: ',''));
		// already know the next was match, so skip 2
		i += 1;
	}
	continue;
}
//Add externals:

//json validation
addons.push('../schemas/schema_appconfig.json');
addons.push('../schemas/schema_datas.json');
addons.push('../schemas/schema_data.json');
addons.push('../schemas/schema_coils.json');
addons.push('../schemas/schema_registers.json');

//for reuse purposal
addons.push('../src/config/slave_config_wago.js')

if (addons.length) {
	await cpy(addons, '../Releases');
}})().catch(e => {console.log(e);throw e;});