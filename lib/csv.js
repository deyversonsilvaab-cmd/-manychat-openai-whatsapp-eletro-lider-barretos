export function delim(l){return (l.match(/;/g)||[]).length>=(l.match(/,/g)||[]).length?";":","}
export function line(l,d){let r=[],c="",q=false;for(let i=0;i<l.length;i++){let ch=l[i],nx=l[i+1];if(ch=='"'&&nx=='"'){c+='"';i++;continue}if(ch=='"'){q=!q;continue}if(ch===d&&!q){r.push(c.trim());c="";continue}c+=ch}r.push(c.trim());return r}
