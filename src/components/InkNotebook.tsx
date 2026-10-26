import { useEffect, useRef, useState } from "react";
import { Eraser, PenLine, Undo2, Trash2 } from "lucide-react";

type Stroke={points:{x:number;y:number}[];color:string;width:number};
type Props={dateKey:string;storageKey:string};
const colors=["#172d52","#171717","#b33131","#977043","#247b57"];
export default function InkNotebook({dateKey,storageKey}:Props){
 const canvas=useRef<HTMLCanvasElement>(null);
 const drawn=useRef<Stroke[]>([]);
 const drawing=useRef<Stroke|null>(null);
 const [strokes,setStrokes]=useState<Stroke[]>([]);
 const [color,setColor]=useState("#172d52");
 const [width,setWidth]=useState(2.5);
 const [mode,setMode]=useState<"pen"|"eraser">("pen");
 const saveKey=storageKey+":ink:"+dateKey;
 useEffect(()=>{try{const value=JSON.parse(localStorage.getItem(saveKey)||"[]");setStrokes(Array.isArray(value)?value:[]);}catch{setStrokes([]);}},[saveKey]);
 useEffect(()=>{drawn.current=strokes;try{localStorage.setItem(saveKey,JSON.stringify(strokes));}catch{/* storage full */}},[strokes,saveKey]);
 const render=()=>{
  const el=canvas.current;if(!el)return;
  const ctx=el.getContext("2d");if(!ctx)return;
  const box=el.getBoundingClientRect();const scale=window.devicePixelRatio||1;
  const w=Math.max(1,Math.round(box.width*scale)),h=Math.max(1,Math.round(box.height*scale));
  if(el.width!==w||el.height!==h){el.width=w;el.height=h;}
  ctx.setTransform(scale,0,0,scale,0,0);ctx.clearRect(0,0,box.width,box.height);
  const paint=(stroke:Stroke)=>{
   if(!stroke.points.length)return;
   ctx.beginPath();ctx.strokeStyle=stroke.color;ctx.lineWidth=stroke.width;ctx.lineJoin="round";ctx.lineCap="round";
   stroke.points.forEach((p,i)=>{const x=p.x*box.width,y=p.y*box.height;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
   if(stroke.points.length===1){const p=stroke.points[0];ctx.lineTo(p.x*box.width+.01,p.y*box.height+.01);}
   ctx.stroke();
  };
  drawn.current.forEach(paint);if(drawing.current)paint(drawing.current);
 };
 useEffect(()=>{render();const obs=new ResizeObserver(render);if(canvas.current)obs.observe(canvas.current);return()=>obs.disconnect();},[dateKey,strokes]);
 const point=(e:React.PointerEvent<HTMLCanvasElement>)=>{const box=e.currentTarget.getBoundingClientRect();return{x:(e.clientX-box.left)/box.width,y:(e.clientY-box.top)/box.height};};
 const start=(e:React.PointerEvent<HTMLCanvasElement>)=>{
  if(e.pointerType==="touch"&&mode==="pen")return; // preserve finger scrolling; pen or mouse draws
  if(e.button!==0&&e.pointerType==="mouse")return;
  e.currentTarget.setPointerCapture(e.pointerId);
  if(mode==="eraser"){
   const p=point(e);const box=e.currentTarget.getBoundingClientRect();
   setStrokes(v=>v.filter(st=>!st.points.some(q=>Math.hypot((q.x-p.x)*box.width,(q.y-p.y)*box.height)<16)));return;
  }
  drawing.current={color,width,points:[point(e)]};render();
 };
 const move=(e:React.PointerEvent<HTMLCanvasElement>)=>{
  if(mode!=="pen"||!drawing.current)return;
  drawing.current.points.push(point(e));render();
 };
 const finish=()=>{if(!drawing.current)return;const s=drawing.current;drawing.current=null;setStrokes(v=>[...v,s]);};
 return <div className="space-y-3">
 <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-[#f8f6f1] p-2">
  <button type="button" onClick={()=>setMode("pen")} className={"rounded-lg px-3 py-2 text-sm "+(mode==="pen"?"bg-[#122452] text-white":"bg-white")}><PenLine className="mr-1 inline" size={16}/> Caneta</button>
  <button type="button" onClick={()=>setMode("eraser")} className={"rounded-lg px-3 py-2 text-sm "+(mode==="eraser"?"bg-[#122452] text-white":"bg-white")}><Eraser className="mr-1 inline" size={16}/> Borracha</button>
  {colors.map(c=><button type="button" key={c} onClick={()=>{setColor(c);setMode("pen");}} aria-label={"Cor "+c} className={"h-7 w-7 rounded-full border-2 "+(color===c?"border-[#b89e71]":"border-white")} style={{backgroundColor:c}}/>)}
  <label className="flex items-center gap-1 text-xs">Espessura <input type="range" min="1" max="9" step=".5" value={width} onChange={e=>setWidth(Number(e.target.value))}/></label>
  <button type="button" onClick={()=>setStrokes(v=>v.slice(0,-1))} className="rounded-lg border bg-white p-2" title="Desfazer último traço"><Undo2 size={16}/></button>
  <button type="button" onClick={()=>{if(confirm("Apagar todos os traços deste dia?"))setStrokes([]);}} className="rounded-lg border bg-white p-2 text-red-600" title="Apagar escrita"><Trash2 size={16}/></button>
 </div>
 <div className="relative overflow-hidden rounded-xl border border-[#dcc8a7] bg-[#fffefa]" style={{backgroundImage:"repeating-linear-gradient(to bottom,transparent 0px,transparent 35px,#e8ddd0 35px,#e8ddd0 36px)"}}>
  <canvas ref={canvas} aria-label="Área de escrita livre com caneta" onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} className="block h-[700px] w-full cursor-crosshair" style={{touchAction:"pan-y"}}/>
 </div>
 <p className="text-xs text-slate-500">Use a caneta do tablet ou o mouse para escrever. O toque do dedo permanece para rolar a página. A borracha remove os traços próximos ao toque. Os desenhos ficam salvos neste dispositivo.</p>
 </div>;
}
