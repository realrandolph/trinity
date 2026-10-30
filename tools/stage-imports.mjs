export function pointAtTrinityRelease(runtime,bundleName){
  const alreadyPinned=`./vendor/trinity/${bundleName}`;
  if(runtime.includes(alreadyPinned))return runtime;
  const pattern=/import\s*\{\s*([^}]+)\s*\}\s*from\s*(['"])(?:\.\/)?vendor\/trinity\/src\/[^'"]+\.js\2\s*;?/g;
  const matches=[...runtime.matchAll(pattern)];
  if(!matches.length){
    if(runtime.includes('/vendor/trinity/src/'))throw new Error('Use named imports from the versioned Trinity release bundle.');
    throw new Error('Point project runtime imports to the versioned Trinity release bundle before staging.');
  }
  const specifiers=[...new Set(matches.flatMap(m=>m[1].split(',').map(s=>s.trim()).filter(Boolean)))];
  if(!specifiers.length||specifiers.some(s=>!/^[\w$]+(?:\s+as\s+[\w$]+)?$/.test(s)))
    throw new Error('Use named imports from the Trinity runtime bundle.');
  let inserted=false;
  const result=runtime.replace(pattern,()=>{
    if(inserted)return '';
    inserted=true;
    return `import {${specifiers.join(',')}} from '${alreadyPinned}';`;
  });
  if(result.includes('/vendor/trinity/src/'))throw new Error('Point all Trinity imports to the release bundle before staging.');
  return result;
}
