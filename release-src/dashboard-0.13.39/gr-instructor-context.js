(() => {
  const clean = value => String(value || "").replace(/\u00a0/g," ").trim();
  const compact = value => clean(value).replace(/^(?:(?:นาย|นางสาว|นาง|น\.ส\.|อาจารย์|ผศ\.|รศ\.|ศ\.|ดร\.|อ\.|Mr\.?|Mrs\.?|Ms\.?|Dr\.?|Prof\.?)\s*)+/i,"").replace(/[^\p{L}\p{M}]/gu,"").toLowerCase();
  const teacher = /(?:^|\n)\s*(?:ข้อมูล(?:และแนะนำ)?ผู้สอน|แนะนำ(?:อาจารย์|ผู้สอน)|(?:รายชื่อ)?อาจารย์ผู้สอน|ผู้สอน(?:\s*[:：]|$)|instructor(?:s|\s+information)?(?:\s*[:：]|\s*$)|lecturer(?:s)?(?:\s*[:：]|\s*$)|teacher(?:\s*[:：]|\s*$)|line\s+group\s+qr\s+code\s+and\s+instructors)/im;
  const photoLabel = /รูป(?:ถ่าย)?(?:ของ)?\s*(?:อาจารย์|ผู้สอน)|ภาพ(?:ถ่าย)?(?:ของ)?\s*(?:อาจารย์|ผู้สอน)|(?:instructor|teacher|lecturer)\s+(?:photo|portrait)|(?:photo|portrait)\s+of\s+(?:the\s+)?(?:instructor|teacher|lecturer)/i;
  const qrText = /(?:qr\s*code|คิวอาร์|คิวอาโค้ด)/i;
  const namePattern = /(?:^|\n)\s*(?:SECTION\s+[A-Z]?\d+\s+)?((?:Ms\.?|Mrs\.?|Mr\.?|Dr\.?|Prof\.?)\s+[A-Z][a-zA-Z'-]{1,35}\s+[A-Z][a-zA-Z'-]{1,45})\b/gm;
  const contactKinds = (text, links = []) => {
    const out = [];
    if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text)) out.push("อีเมล");
    if (/(?:line\s*id\s*(?:[:：]\s*|\s+)[@\w.-]{2,}|https?:\/\/(?:line\.me|lin\.ee)\/|ไลน์\s*[:：]\s*\S+)/i.test(text) || links.some(x=>/^https?:\/\/(?:line\.me|lin\.ee)\//i.test(x))) out.push("LINE");
    if (/(?:โทร(?:ศัพท์)?|telephone|phone|mobile|มือถือ)\s*[:：]?\s*\+?[\d()\s-]{8,}/i.test(text)) out.push("โทรศัพท์");
    if (links.some(x=>/^https?:\/\/(?:www\.)?(?:facebook\.com|m\.me|teams\.microsoft\.com)\//i.test(x))) out.push("ช่องทางออนไลน์");
    return [...new Set(out)];
  };
  function evaluate(regions, expectedInstructor = "", scanMode = "dom_context") {
    const expected = String(expectedInstructor || "").split(/[,;/]|\s+และ\s+/).map(clean).filter(Boolean);
    const nameMatches = t => expected.filter(name=>compact(name).length>=5 && compact(t).includes(compact(name)));
    const contextualContact = text=>/(?:สถานที่ติดต่อ|ติดต่อ(?:อาจารย์|ผู้สอน)|อาจารย์(?:จะ|เข้า|ตอบ|ผู้สอน)|เวลาติดต่อ|instructor contact|office hours)/i.test(text);
    const rows=regions.map(r=>{
      const text=clean(r.text), title=clean(r.title), images=(r.images||[]).filter(i=>i.candidate===true);
      const matched=nameMatches(text), explicit=teacher.test(text)||teacher.test(title)||(contextualContact(text)&&contactKinds(text,r.links||[]).length>0);
      return {...r,text,title,images,matched,explicit,contacts:contactKinds(text,r.links||[])};
    });
    const result={names:[],contactChannels:[],expectedInstructorMatches:[],hasIntroductionImage:false,hasInstructorPhoto:false,identityComplete:false,contactComplete:false,scanMode,reviewStatus:"incomplete_evidence",provenance:{names:[],photos:[],contacts:[],uncertain:[],rejected:[]}};
    let best=null;
    for(let k=0;k<rows.length;k++){
      const anchor=rows[k];
      if(!anchor.explicit&&!anchor.matched.length)continue;
      // Only neighboring authored labels inside the same introductory section.
      // Never attach a name, portrait or social link elsewhere in the course.
      const cluster=rows.filter((r,j)=>r.section===anchor.section&&Math.abs(j-k)<=2);
      const text=cluster.map(r=>r.text).join("\n"), matched=[...new Set(cluster.flatMap(r=>r.matched))];
      const names=[...new Set([...matched,...(anchor.explicit?[...text.matchAll(namePattern)].map(m=>m[1]):[])])];
      const channels=[...new Set(cluster.flatMap(r=>r.contacts))];
      const images=cluster.flatMap(r=>r.images.map(i=>({...i,location:r.title||r.section})));
      if(images.some(i=>i.qr===true)&&!channels.includes("QR Code"))channels.push("QR Code");
      const portrait=images.find(i=>i.face===true||photoLabel.test(i.label||""));
      const candidate=images.length>0;
      const contactHint=qrText.test(text);
      // QR text alone is not proof of a usable contact. A generic image is
      // not proof of a portrait. Keep actionable uncertainty for reviewer.
      const nameWaived=names.length===0&&Boolean(portrait)&&channels.some(c=>c!=="QR Code")&&anchor.explicit;
      const complete=(names.length>0||nameWaived)&&channels.length>0&&Boolean(portrait);
      const uncertain=!complete&&((candidate&&(names.length>0||channels.length>0||contactHint||anchor.explicit))||(names.length>0&&channels.length>0));
      const weight=complete?100:(uncertain?10:0)+Number(candidate)+Number(names.length>0)+Number(channels.length>0);
      if(!best||weight>best.weight)best={weight,anchor,cluster,names,matched,channels,images,portrait,candidate,complete,uncertain,contactHint,nameWaived};
    }
    if(!best)return result;
    result.names=best.names;result.expectedInstructorMatches=best.matched;result.contactChannels=best.channels;
    result.hasIntroductionImage=best.candidate;result.hasInstructorPhoto=Boolean(best.portrait);
    result.identityComplete=best.names.length>0&&result.hasInstructorPhoto;result.contactComplete=best.channels.length>0;result.nameWaived=best.nameWaived===true;
    result.reviewStatus=best.complete?"evidence_found":best.uncertain?"uncertain_evidence":"incomplete_evidence";
    const location=best.anchor.title||best.anchor.section;
    result.provenance.names=best.names.map(name=>({location,sourceType:"authored_intro_text",evidenceText:name,decisionReason:"name_in_instructor_context"}));
    result.provenance.contacts=best.channels.map(channel=>({location,sourceType:"authored_intro_contact",evidenceText:channel,decisionReason:"contact_in_same_intro_context"}));
    if(best.portrait)result.provenance.photos=[{location:best.portrait.location,sourceType:"intro_image",decisionReason:best.portrait.face?"face_detected_in_contextual_image":"explicit_portrait_label"}];
    if(best.uncertain)result.provenance.uncertain=[{location,sourceType:"intro_candidate",evidenceText:"พบหลักฐานในบริบทข้อมูลผู้สอน: "+[best.candidate?"รูปประกอบ":null,best.names.length?"ชื่อ":null,best.channels.length?"ช่องทางติดต่อ":null,best.contactHint?"ข้อความ QR":null].filter(Boolean).join(" · "),decisionReason:"manual_verify_photo_name_contact"}];
    return result;
  }
  globalThis.SpuGrInstructorContext={evaluate,contactKinds,compact};
  if(typeof chrome==="undefined"||!chrome.runtime?.onMessage||typeof document==="undefined")return;
  const within=(task,ms)=>Promise.race([Promise.resolve().then(task).catch(()=>null),new Promise(resolve=>setTimeout(()=>resolve(null),ms))]);
  function authoredRegions(){
    const root=document.querySelector("#region-main .course-content")||document.querySelector("#region-main");
    if(!root)return null;
    const sections=[...root.querySelectorAll("li.section, [id^='section-'], .course-section")].filter(el=>!el.parentElement?.closest("li.section, [id^='section-'], .course-section"));
    if(!sections.length)return null;
    const found=[];
    for(const [idx,section] of sections.entries()){
      const title=clean(section.querySelector(".sectionname,.section-title,h2,h3")?.innerText||"");
      const explicitLater=/(?:week|session|ครั้งที่|สัปดาห์ที่)\s*(?:[2-9]|1[0-9])\b/i.test(title);
      if(explicitLater&&!teacher.test(title))continue;
      if(idx>2&&!teacher.test(title)&&!/(?:week|session|ครั้งที่|สัปดาห์ที่)\s*1\b|introduction|แนะนำรายวิชา|^general$/i.test(title))continue;
      const nodes=[...section.querySelectorAll(".summary,.modtype_label,.modtype_textandmedia,.contentwithoutlink,.activity-description,[data-region='activity-description']")].filter(node=>{
        const activity=node.closest(".activity");
        return !activity||activity.matches(".modtype_label,.modtype_textandmedia,[data-modname='label'],[data-modname='textandmedia']");
      }).filter((node,i,arr)=>!arr.some(other=>other!==node&&other.contains(node)));
      for(const node of nodes){
        if(node.closest("[hidden],[aria-hidden='true'],.activity-hidden,.dimmed_text"))continue;
        const clone=node.cloneNode(true);
        clone.querySelectorAll("script,style,.activity-completion,[role='checkbox'],.accesshide,.sr-only,.userpicture,.avatar,.completion-info").forEach(e=>e.remove());
        const text=clean(node.innerText||clone.textContent||"").slice(0,6000);
        const links=[...node.querySelectorAll("a[href]")].map(a=>a.href).slice(0,20);
        const images=[...node.querySelectorAll("img")].filter(img=>{
          const label=clean([img.alt,img.title,img.getAttribute("aria-label")].join(" "));
          return !img.closest(".userpicture,.avatar,.activityiconcontainer,.completion-info,[role='checkbox'],nav,header,a[href*='/user/']")&&!/avatar|userpicture|activityicon|checkbox|completion|logo|badge|ไอคอน|โลโก้/i.test(label+" "+String(img.className)+" "+String(img.src||""))&&((img.naturalWidth>=96&&img.naturalHeight>=96)||(img.width>=96&&img.height>=96));
        }).slice(0,6).map(img=>({node:img,candidate:true,label:clean([img.alt,img.title,img.getAttribute("aria-label")].join(" ")),qr:false,face:false}));
        if(text||images.length)found.push({section:String(section.id||idx),title,text,links,images});
      }
    }
    return found.slice(0,60);
  }
  async function scan(expected){
    const regions=authoredRegions();
    if(regions===null)return {ok:false,error:"ไม่พบโครงสร้างส่วนแนะนำรายวิชา"};
    let evidence=evaluate(regions,expected);
    if(evidence.reviewStatus==="evidence_found")return {ok:true,instructorEvidence:evidence};
    // Inspect up to two contextual image candidates; do not queue OCR for
    // every image or use Moodle avatars. Unread images remain uncertain.
    const picks=regions.flatMap((r,i)=>r.images.map(image=>({r,i,image}))).filter(x=>regions.some((r,i)=>r.section===x.r.section&&Math.abs(i-x.i)<=2&&(teacher.test(r.text)||teacher.test(r.title)||(/(?:สถานที่ติดต่อ|ติดต่อ(?:อาจารย์|ผู้สอน)|อาจารย์(?:จะ|เข้า|ตอบ|ผู้สอน)|เวลาติดต่อ|instructor contact|office hours)/i.test(r.text)&&contactKinds(r.text,r.links||[]).length>0)||String(expected||"").split(/[,;/]/).some(n=>compact(n).length>=5&&compact(r.text).includes(compact(n)))))).slice(0,2);
    for(const {image} of picks){
      if(!image.node.complete||!image.node.naturalWidth)continue;
      if(typeof BarcodeDetector!=="undefined"){const codes=await within(()=>new BarcodeDetector({formats:["qr_code"]}).detect(image.node),1800);image.qr=Array.isArray(codes)&&codes.length>0;}
      if(typeof FaceDetector!=="undefined"){const faces=await within(()=>new FaceDetector({fastMode:true,maxDetectedFaces:1}).detect(image.node),1800);image.face=Array.isArray(faces)&&faces.length>0;}
    }
    evidence=evaluate(regions,expected);
    let ocrStatus="not_needed";
    if(evidence.reviewStatus!=="evidence_found"&&picks.length&&(!evidence.names.length||!evidence.contactChannels.length)){
      const pick=picks.find(x=>x.image.node.complete&&x.image.node.naturalWidth);
      if(pick&&typeof globalThis.dlearningOcr?.readImage==="function"){
        const read=await within(()=>globalThis.dlearningOcr.readImage(pick.image.node),24000);
        ocrStatus=read?.status==="read"?"complete":read===null?"timeout":"unavailable";
        if(read?.status==="read"&&Number(read.confidence||0)>=55)pick.r.text+="\n"+clean(read.text).slice(0,2500);
      } else ocrStatus="unavailable";
      evidence=evaluate(regions,expected,"targeted_intro_ocr");
    }
    evidence.targetedOcrStatus=ocrStatus;evidence.contextRegionCount=regions.length;
    // No photo is asserted merely from OCR or generic image presence.
    return {ok:true,instructorEvidence:evidence};
  }
  chrome.runtime.onMessage.addListener((msg,_sender,sendResponse)=>{
    if(msg?.type!=="SCAN_GR_INSTRUCTOR_CONTEXT")return;
    scan(msg.expectedInstructor||"").then(sendResponse).catch(error=>sendResponse({ok:false,error:String(error?.message||error)}));
    return true;
  });
})();
