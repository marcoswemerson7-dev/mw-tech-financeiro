import { useEffect, useRef } from "react";
import { useAuth } from "../lib/auth";
import { getMonitoringIncidents } from "../services/incidents";

const SEEN_KEY = "mw-control:notified-incidents";

function playAlertTone() {
  try {
    const Ctor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 740;
    gain.gain.value = 0.06;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.22);
    window.setTimeout(()=>void ctx.close(),350);
  } catch {}
}

export default function IncidentNotifier(){
  const { session } = useAuth();
  const initialized = useRef(false);

  useEffect(()=>{
    if(!session) return;
    let disposed=false;
    const poll=async()=>{
      try{
        const {active}=await getMonitoringIncidents();
        if(disposed) return;
        let seen:string[]=[];
        try{seen=JSON.parse(localStorage.getItem(SEEN_KEY)||"[]")}catch{}
        const set=new Set(seen);
        const fresh=active.filter(item=>!set.has(item.id));
        if(initialized.current && fresh.length){
          const critical=fresh.filter(item=>item.severity==="critical");
          if(critical.length) playAlertTone();
          if("Notification" in window && Notification.permission==="granted"){
            const top=critical[0]||fresh[0];
            new Notification(critical.length? "Incidente crítico · MW TECH":"Novo alerta · MW TECH",{
              body:`${top.systemLabel}: ${top.title}`,
              icon:"/mw-tech-logo.png",
            });
          }
        }
        localStorage.setItem(SEEN_KEY,JSON.stringify([...new Set([...seen,...active.map(item=>item.id)])].slice(-300)));
        initialized.current=true;
      }catch{}
    };
    void poll();
    const id=window.setInterval(()=>void poll(),60000);
    return()=>{disposed=true;window.clearInterval(id)};
  },[session]);

  return null;
}
