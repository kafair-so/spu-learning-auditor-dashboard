// Narrow GR 1/2569 topology repairs. Never bypass unclear or incomplete scans.
export function repairLegacyCourseTopology(topology,payload,activities,sectionKey){
 if(payload.courseType!=="GR"||payload.criteriaMode!=="legacy_12569"||payload.semesterCode!=="1/2569"||payload.coverage?.reachedEnd!==true||payload.coverage?.structurallyComplete!==true||topology.expectedSessions!==15||topology.confidence!=="high"||topology.reviewRequired!==true)return false;
 const id=String(payload.courseUrl||"").match(/^https:\/\/(?:dlearning|ilearning)\.spu\.ac\.th\/course\/view\.php\?(?:[^#]*&)?id=(\d+)(?:[&#]|$)/i)?.[1];
 const rows=topology.mappingRows||[],issues=topology.safetyIssues||[];
 if(issues.length!==1||new Set(rows.map(r=>r.key)).size!==rows.length)return false;
 const edits=new Map();
 if(id==="21399"){
   const numbered=rows.map((row,index)=>({row,index,match:String(row.section||"").match(/^Week\s+(\d+)\s*:\s*ครั้งที่\s*(\d+)(?=\s|$)/i)})).filter(x=>x.match);
   if(numbered.length!==15||!numbered.every((x,i)=>Number(x.match[1])===i&&Number(x.match[2])===i+1&&x.index===numbered[0].index+i&&!x.row.ignored&&!x.row.outOfRange))return false;
   if(issues[0]!=="ลำดับครั้งเรียนย้อนกลับที่ "+numbered[1].row.section)return false;
   if(rows.slice(0,numbered[0].index).some(row=>!row.ignored&&!row.outOfRange&&Number(row.chosenSession)!==1)||numbered.at(-1).index!==rows.length-1)return false;
   for(let i=0;i<15;i++)edits.set(numbered[i].row.key,{session:i+1,reason:"ยึดเลขครั้งที่ระบุชัดในหัวข้อ Week 0–14 / ครั้งที่ 1–15"});
 }else if(id==="962"){
   const first=rows.findIndex(r=>r.section==="Week 1"&&Number(r.chosenSession)===1);
   const extra=rows.filter((r,i)=>i<first&&r.section==="ADDITIONAL INFO"&&Number(r.chosenSession)===2&&r.declaredSession==null&&!r.ignored&&!r.outOfRange);
   const explicit=rows.filter(r=>/^Week\s+\d+$/i.test(r.section||""));
   if(first<0||extra.length!==1||issues[0]!=="ลำดับครั้งเรียนย้อนกลับที่ Week 1"||explicit.length!==15||!explicit.every((r,i)=>Number(r.declaredSession)===i+1&&Number(r.chosenSession)===i+1&&!r.ignored&&!r.outOfRange))return false;
   if(activities.some(a=>sectionKey(a)===extra[0].key||a.section===extra[0].section))return false;
   if(rows.slice(0,first).some(r=>r.key!==extra[0].key&&!r.ignored&&!r.outOfRange&&Number(r.chosenSession)!==1))return false;
   edits.set(extra[0].key,{session:0,reason:"กล่อง ADDITIONAL INFO ไม่มีรายการกิจกรรมที่สแกนพบ จึงไม่นับเป็นครั้งเรียน"});
 }else return false;
 const proposed=rows.map(r=>edits.has(r.key)?edits.get(r.key).session:r.ignored||r.outOfRange?0:Number(r.chosenSession)||0).filter(Boolean);
 if(!Array.from({length:15},(_,i)=>i+1).every(n=>proposed.includes(n))||proposed.some((n,i)=>i>0&&n<proposed[i-1]))return false;
 const excluded=new Set(topology.outOfRangeSections||[]);
 for(const row of rows){const edit=edits.get(row.key);if(!edit)continue;
   topology.mapping.delete(row.key);
   if(edit.session>0){topology.mapping.set(row.key,edit.session);excluded.delete(row.key)}else excluded.add(row.key);
   row.chosenSession=edit.session||null;row.ignored=edit.session===0;row.outOfRange=false;row.reason=edit.reason;
 }
 topology.outOfRangeSections=[...excluded];
 topology.diagnostics=[...(topology.diagnostics||[]).filter(d=>!rows.some(r=>edits.has(r.key)&&r.section===d.section)),...rows.filter(r=>edits.has(r.key)).map(r=>({section:r.section,reason:r.reason,excluded:r.ignored}))];
 topology.safetyIssues=[];topology.reviewRequired=false;
 return true;
}
