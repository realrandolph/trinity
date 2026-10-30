// Display labels describe effective settings; the original binding remains authoritative.
export function surfaceAssignmentName(material,assignment){
  if(material.id!=='grwm/studio-surface@3')return material.name;
  const parameters={...material.parameters,...assignment?.material.parameters};
  if(parameters.metal>=.5)return parameters.rough<=.3?'Polished Metal':'Satin-Finish Metal';
  return parameters.rough>=.65?'Matte Nonmetallic Surface':'Smooth Nonmetallic Surface';
}
// UI/editor groups derive from Model slots and effective Prop/Variant bindings.
// Each group retains its exact Material and Color resource IDs.
export function groupSurfaceAssignments(catalog,model,defaults,overrides=[]){
  const resources=new Map(catalog.assets.map(a=>[a.id,a]));
  const assignments=new Map([...defaults,...overrides].map(s=>[s.slotId,s]));
  const groups=new Map();
  for(const slot of model.slots??[]){
    const assignment=assignments.get(slot.id);if(!assignment)continue;
    const material=resources.get(assignment.material.id),colorId=assignment.color?.id??material?.defaultColorId;
    if(!material||!resources.has(colorId))throw new Error(`Missing Material/Color for surface slot ${slot.name}`);
    const key=JSON.stringify([material.id,colorId]);
    if(!groups.has(key))groups.set(key,{id:key,materialId:material.id,colorId,name:`${material.name} · ${resources.get(colorId).name}`,slotIds:[],partIds:[],assignments:[]});
    const group=groups.get(key);group.slotIds.push(slot.id);group.partIds.push(...slot.partIds);group.assignments.push(assignment);
  }
  return [...groups.values()].map(g=>({...g,name:`${[...new Set(g.assignments.map(s=>surfaceAssignmentName(resources.get(g.materialId),s)))].join(' / ')} · ${resources.get(g.colorId).name}`,partIds:[...new Set(g.partIds)],usesDefaultColor:g.assignments.every(s=>!s.color?.id),mixedColorInheritance:g.assignments.some(s=>!s.color?.id)&&g.assignments.some(s=>s.color?.id)}));
}
