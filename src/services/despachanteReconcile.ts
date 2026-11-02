/** Three-way synchronization. Never resolves conflicting edits by dropping a device's data. */
type RecordValue = { id: string; [key: string]: unknown };
export type SyncSnapshot = { clients: RecordValue[]; models: RecordValue[]; jobs: RecordValue[]; processes: RecordValue[] };
const same = (a: unknown, b: unknown): boolean => {
 if (Object.is(a,b)) return true;
 if (Array.isArray(a) && Array.isArray(b)) return a.length===b.length && a.every((v,i)=>same(v,b[i]));
 if (a && b && typeof a==='object' && typeof b==='object' && !Array.isArray(a) && !Array.isArray(b)) {
  const x=a as Record<string,unknown>, y=b as Record<string,unknown>;
  return [...new Set([...Object.keys(x),...Object.keys(y)])].every(k=>same(x[k],y[k]));
 }
 return false;
};
export function sameSnapshot(a:unknown,b:unknown):boolean {
 if(!a||!b||typeof a!=="object"||typeof b!=="object")return same(a,b);
 const left=a as Record<string,unknown>,right=b as Record<string,unknown>;
 return [...new Set([...Object.keys(left),...Object.keys(right)])].every(key=>{
  if(["clients","models","jobs","processes"].includes(key)&&Array.isArray(left[key])&&Array.isArray(right[key])){
   const x=left[key] as RecordValue[],y=right[key] as RecordValue[];
   const indexed=new Map(y.map(r=>[r.id,r]));return x.length===y.length&&x.every(r=>same(r,indexed.get(r.id)));
  }
  return same(left[key],right[key]);
 });
}
export function reconcileSnapshots<T extends SyncSnapshot>(base:T|null,local:T,remote:T,choices:Record<string,"local"|"remote">={}):{data:T;conflicts:string[]} {
 const conflicts:string[]=[];
 function field(b:unknown,l:unknown,r:unknown,path:string):unknown {
  if(same(l,r))return l;
  if(same(l,b))return r;
  if(same(r,b))return l;
  if(path.endsWith('.updatedAt')&&typeof l==='string'&&typeof r==='string')return l>r?l:r;
  if(path.endsWith('.history')&&Array.isArray(l)&&Array.isArray(r)){
   const entries=new Map<string,unknown>();
   for(const entry of [...r,...l]){const h=entry as {id?:string};entries.set(h.id||JSON.stringify(entry),entry);}
   return [...entries.values()].sort((a,b)=>String((b as {at?:string}).at||'').localeCompare(String((a as {at?:string}).at||'')));
  }
  if(b===undefined){
   if(l===undefined||l===''||l===null)return r;
   if(r===undefined||r===''||r===null)return l;
   if(Array.isArray(l)&&!l.length)return r;
   if(Array.isArray(r)&&!r.length)return l;
  }
  if(l&&r&&typeof l==='object'&&typeof r==='object'&&!Array.isArray(l)&&!Array.isArray(r)){
   const left=l as Record<string,unknown>,right=r as Record<string,unknown>,before=(b||{}) as Record<string,unknown>;
   return Object.fromEntries([...new Set([...Object.keys(before),...Object.keys(left),...Object.keys(right)])].map(k=>[k,field(before[k],left[k],right[k],path+'.'+k)]));
  }
  const choice=choices[path.split('.').slice(0,2).join('.')];
  if(choice)return choice==='local'?l:r;
  conflicts.push(path);return l;
 }
 const data={...local};
 for(const key of ['clients','models','jobs','processes'] as const){
  const before=new Map((base?.[key]||[]).map(x=>[x.id,x]));
  const left=new Map(local[key].map(x=>[x.id,x])),right=new Map(remote[key].map(x=>[x.id,x]));
  data[key]=[...new Set([...left.keys(),...right.keys(),...before.keys()])].flatMap(id=>{
   const b=before.get(id),l=left.get(id),r=right.get(id);
   if(!l&&!r)return [];
   if(b&&(!l||!r)){
    const survivor=l||r;
    if(same(survivor,b))return []; // Propagate a deletion only against its unchanged baseline.
    const choice=choices[key+'.'+id];
    if(choice){const selected=choice==='local'?l:r;return selected?[selected]:[];}
    conflicts.push(key+'.'+id+'.exclusão');return survivor?[survivor]:[];
   }
   if(!l)return r?[r]:[];
   if(!r)return [l];
   return [field(b,l,r,key+'.'+id) as RecordValue];
  });
 }
 return {data,conflicts};
}
