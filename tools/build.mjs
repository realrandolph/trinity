import {build} from 'esbuild';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
const filename=`trinity-${pkg.version}.mjs`;
const outputDir=path.join(root,'dist');await mkdir(outputDir,{recursive:true});
const output=path.join(outputDir,filename);
await build({
  entryPoints:[path.join(root,'src/index.js')],
  outfile:output,
  bundle:true,
  format:'esm',
  platform:'browser',
  target:['es2022'],
  minify:true,
  legalComments:'none',
  banner:{js:`/* Trinity ${pkg.version}; renderer ABI trinity-grwm-v2 */`},
});
const digest=createHash('sha256').update(await readFile(output)).digest('hex');
await writeFile(path.join(outputDir,'SHA256SUMS'),`${digest}  ${filename}\n`);
const api=await import(pathToFileURL(output).href);
for(const name of ['createRenderer','loadScene','loadLibrary','resolveColor','validateMesh'])
  if(typeof api[name]!=='function')throw new Error(`Release bundle is missing ${name}`);
console.log(`Built ${path.relative(root,output)} (${digest})`);
