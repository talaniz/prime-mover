import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WebSocketServer} from 'ws';
import {AppServer} from '../../dist/app-server.js';
async function fixture(t, handler) {
 const dir=await mkdtemp(join(tmpdir(),'pm-rpc-')); const socket=join(dir,'s.sock');
 const server=http.createServer(); const ws=new WebSocketServer({server,perMessageDeflate:false});
 const received=[];
 ws.on('connection',peer=>peer.on('message',raw=>{const m=JSON.parse(raw);received.push(m);if(m.method==='initialize')peer.send(JSON.stringify({id:m.id,result:{userAgent:'codex/0.155.1'}}));else handler(peer,m);}));
 await new Promise(resolve=>server.listen(socket,resolve));
 const client=new AppServer(socket,100);
 t.after(async()=>{client.close();for(const p of ws.clients)p.terminate();await new Promise(r=>ws.close(r));await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});});
 return {client,received};
}
test('handshake precedes multiplexed lifecycle RPC and initialized notification',async t=>{
 const {client,received}=await fixture(t,(p,m)=>{if(m.id!==undefined)p.send(JSON.stringify({id:m.id,result:{thread:{id:m.params.threadId}}}));});
 await client.connect();
 assert.deepEqual(await client.request('thread/read',{threadId:'owned',includeTurns:false}),{thread:{id:'owned'}});
 assert.equal(received[0].method,'initialize'); assert.equal(received[1].method,'initialized');
 assert.equal(received[0].params.capabilities.experimentalApi,true);
});
test('server errors are actionable without reflecting secret-bearing remote text',async t=>{
 const {client}=await fixture(t,(p,m)=>{if(m.id!==undefined)p.send(JSON.stringify({id:m.id,error:{code:401,message:'secret-value'}}));});
 await client.connect();await assert.rejects(client.request('thread/read',{}),e=>/401/.test(e.message)&&!e.message.includes('secret-value'));
});
test('timeout rejects ambiguous operation rather than retrying automatically',async t=>{
 const {client,received}=await fixture(t,()=>{});await client.connect();await assert.rejects(client.request('turn/start',{}),/timed out.*reconcile/i);assert.equal(received.filter(m=>m.method==='turn/start').length,1);
});
test('disconnect rejects pending RPC without issuing a replacement',async t=>{
 const {client}=await fixture(t,(p,m)=>{if(m.method==='turn/start')p.close();});await client.connect();await assert.rejects(client.request('turn/start',{}),/disconnect.*reconcile/i);
});
test('approval requests remain visible and are never auto-accepted by client',async t=>{
 const {client,received}=await fixture(t,(p,m)=>{if(m.method==='thread/read'){p.send(JSON.stringify({id:'approval',method:'item/commandExecution/requestApproval',params:{threadId:'owned',turnId:'turn'}}));p.send(JSON.stringify({id:m.id,result:{thread:{id:'owned'}}}));}});
 const events=[];client.on('notification',e=>events.push(e));await client.connect();await client.request('thread/read',{});assert.equal(events[0]?.id,'approval');assert.equal(received.some(m=>m.id==='approval'),false);
});
