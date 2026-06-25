export const clean=v=>v==null?"":String(v).trim();
export const norm=t=>String(t||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^\w\s\/\-\.\,\(\)"]/g," ").replace(/\s+/g," ").trim();
export function safeJson(v,f=[]){try{if(!v)return f;if(Array.isArray(v)||typeof v==="object")return v;return JSON.parse(v)}catch{return f}}
export const cors=()=>({"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization"});
export const truth=v=>v===true||v==="true"||v==="1"||v===1;
