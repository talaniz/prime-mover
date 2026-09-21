import test from 'node:test';
import assert from 'node:assert/strict';
import {threadOptions,classifyThread} from '../../dist/app-server.js';
test('new and resumed jobs retain sandbox and auto-review policy',()=>{const p=threadOptions('/isolated');assert.equal(p.approvalPolicy,'on-request');assert.equal(p.approvalsReviewer,'auto_review');assert.equal(p.sandbox,'workspace-write');assert.equal(p.ephemeral,false);});
test('only explicit idle state permits scheduling; unknown history fails closed',()=>{
 for(const [status,expected] of [[{type:'idle'},'idle'],[{type:'active',activeFlags:[]},'active'],[{type:'active',activeFlags:['waitingOnApproval']},'waiting'],[{type:'active',activeFlags:['waitingOnUserInput']},'waiting'],[{type:'notLoaded'},'unknown'],[{type:'systemError'},'blocked'],[null,'unknown']])assert.equal(classifyThread({status}),expected);
});
