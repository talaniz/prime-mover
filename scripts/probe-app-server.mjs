// Explicit live acceptance probe. Never starts issue intake or changes services.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {AppServer,threadOptions,classifyThread} from '../dist/app-server.js';
const [socket,cwd,evidencePath]=process.argv.slice(2);
if(!socket||!cwd||!evidencePath)throw Error('Usage: probe-app-server SOCKET ISOLATED_CWD EVIDENCE_JSON');
await mkdir(cwd,{recursive:true});
let evidence;
try {evidence=JSON.parse(await readFile(evidencePath,'utf8'));} catch(e) {if(e.code!=='ENOENT')throw e;evidence={};}
const save=()=>writeFile(evidencePath,JSON.stringify(evidence,null,2)+'\n',{mode:0o600});
let client=new AppServer(socket,30000);
try {
 await client.connect();
 if(!evidence.threadId){
  if(evidence.threadIntent)throw Error('Ambiguous prior thread intent; reconcile before creating another task');
  evidence.threadIntent=true;await save();
  const r=await client.request('thread/start',threadOptions(cwd));
  evidence.threadId=r.thread.id;await save();
 }
 if(!evidence.turnId){
  if(evidence.turnIntent)throw Error('Ambiguous prior turn intent; inspect saved thread history before rerun');
  evidence.turnIntent=true;await save();
  const r=await client.request('turn/start',{threadId:evidence.threadId,input:[{type:'text',text:'Reply exactly PRIME_MOVER_PROBE_OK. Do not use tools, modify files, or create any other tasks.'}]});
  evidence.turnId=r.turn.id;await save();
 }
 const deadline=Date.now()+180000;
 while(Date.now()<deadline){
  const r=await client.request('thread/read',{threadId:evidence.threadId,includeTurns:false});
  const state=classifyThread(r.thread);
  if(state==='waiting'||state==='blocked')throw Error(`Probe ${state}; inspect thread ${evidence.threadId}`);
  const page=await client.request('thread/turns/list',{threadId:evidence.threadId,limit:20,itemsView:'full'});
  const turn=page.data.find(t=>t.id===evidence.turnId);
  if(turn?.status==='completed'){
   const text=turn.items.filter(i=>i.type==='agentMessage').map(i=>i.text).join('\n');
   if(!text.includes('PRIME_MOVER_PROBE_OK'))throw Error('Probe completed without required output');
   evidence.completed=true;await save();break;
  }
  if(turn?.status==='failed'||turn?.status==='interrupted')throw Error(`Probe turn ${turn.status}`);
  await new Promise(r=>setTimeout(r,1500));
 }
 if(!evidence.completed)throw Error('Probe observation deadline; retain IDs and inspect existing turn, do not restart');
 client.close();client=new AppServer(socket,30000);await client.connect();
 const read=await client.request('thread/read',{threadId:evidence.threadId,includeTurns:false});
 const resumed=await client.request('thread/resume',{threadId:evidence.threadId,...threadOptions(cwd)});
 if(read.thread.id!==evidence.threadId||resumed.thread.id!==evidence.threadId)throw Error('Reconnect identity mismatch');
 if(resumed.approvalPolicy!=='on-request'||resumed.approvalsReviewer!=='auto_review'||resumed.sandbox?.type!=='workspaceWrite')throw Error('Resumed approval/sandbox contract mismatch');
 evidence.approvalPolicy=resumed.approvalPolicy;evidence.approvalsReviewer=resumed.approvalsReviewer;evidence.sandbox=resumed.sandbox.type;
 evidence.reconnected=true;evidence.resumed=true;evidence.status=classifyThread(resumed.thread);await save();
 console.log(JSON.stringify(evidence));
}finally{client.close();}
