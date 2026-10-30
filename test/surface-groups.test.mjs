import test from 'node:test';
import assert from 'node:assert/strict';
import {groupSurfaceAssignments,surfaceAssignmentName} from '../src/surface-groups.js';
test('pair groups ignore surface overrides, resolve defaults and follow variant assignments',()=>{
  const catalog={assets:[{id:'metal',name:'Metal',defaultColorId:'gold'},{id:'silk',name:'Silk',defaultColorId:'gold'},{id:'gold',name:'Gold'},{id:'blue',name:'Blue'}]};
  const model={slots:['a','b','c','d'].map(id=>({id,name:id,partIds:[id+'1',id+'2']}))};
  const defaults=[{slotId:'a',material:{id:'metal',parameters:{rough:.2}}},{slotId:'b',material:{id:'metal',parameters:{rough:.7}},color:{id:'gold'}},{slotId:'c',material:{id:'silk'},color:{id:'gold'}},{slotId:'d',material:{id:'metal'},color:{id:'blue'}}];
  const before=JSON.stringify(defaults),groups=groupSurfaceAssignments(catalog,model,defaults);
  assert.equal(groups.length,3);assert.deepEqual(groups[0].slotIds,['a','b']);assert.equal(groups[0].partIds.length,4);assert.equal(groups[0].mixedColorInheritance,true);
  const changed=groupSurfaceAssignments(catalog,model,defaults,[{slotId:'b',material:{id:'metal'},color:{id:'blue'}}]);
  assert.deepEqual(changed.find(g=>g.materialId==='metal'&&g.colorId==='blue').slotIds,['b','d']);
  assert.equal(changed.find(g=>g.colorId==='gold'&&g.materialId==='metal').usesDefaultColor,true);
  assert.equal(JSON.stringify(defaults),before,'Grouping preserves its model and assignment inputs');
});
test('smooth-surface labels describe effective settings and preserve inputs',()=>{
  const material={id:'grwm/studio-surface@3',name:'Smooth Surface',parameters:{metal:0,rough:.35}};
  const assignment={material:{id:material.id,parameters:{metal:.96,rough:.24,gold_finish:true}}};
  const before=JSON.stringify({material,assignment});
  assert.equal(surfaceAssignmentName(material,assignment),'Polished Metal');
  assert.equal(surfaceAssignmentName(material),'Smooth Nonmetallic Surface');
  assert.equal(JSON.stringify({material,assignment}),before);
});
