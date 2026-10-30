export type Vec3 = [number, number, number];
export type Vec4 = [number, number, number, number];
export interface Transform {
  model: Float32Array;
  art: Vec4; perc: Vec4; voice: Vec4; extra: Vec4;
  lighting?: Vec4;
}
export interface Camera {eye: Vec3; target: Vec3; view: Float32Array}
export interface Atmosphere {
  tint: Vec3; keyGain: number; fill: number; fog: number;
  glints: Array<{seed:number;sizePx:number;energy:number;rotation:number}>;
  colorA?: Vec3; colorB?: Vec3; showEnergy?: number;
  beams?: Array<{start:Vec3;end:Vec3;width:number;color:Vec3;energy:number}>;
  particles?: Array<{point:Vec3;sizePx:number;energy:number;rotation:number;kind:number;color:Vec3;opacity?:number}>;
}
export interface Frame {
  t: number;
  world: {nodes: object[];rigs: object[];background:Vec3;accent:Vec3};
  transforms: Transform[];
  cam: Camera;
  projection: Float32Array;
  atmosphere?: Atmosphere;
  light?: Vec3;
  lightMatrix?: Float32Array;
  exposure?: number;
  originZ?: number;
  contacts?: {points:Float32Array;sizes:Float32Array;count:number};
  bloomStrength?: number;
  noParticles?: boolean;
  selectedRig?: {id:number};
  transition?: {node:object;transform:Transform;world:Frame['world']};
}
export interface Renderer {
  render(frame:Frame): {rendered_glints:number;renderedShow?:{particles:number;shafts:number};bloomSettings?:object;reflection?:{mirror:string}|null};
  dispose():void;
}
