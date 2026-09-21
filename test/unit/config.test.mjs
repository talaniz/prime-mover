import test from 'node:test';
import assert from 'node:assert/strict';
import {validateConfig, validateCapabilities, validateCredentials} from '../../dist/config.js';
export const fixture = () => ({schemaVersion:1, storage:{mount:'/mnt/external',uuid:'fixture-uuid',root:'/mnt/external/codex-work'},appServer:{socket:'/tmp/codex.sock',version:'0.155.1'},metadata:{socket:'/mnt/external/codex-work/data/metadata.sock',tokenFile:'/tmp/token',freshnessSeconds:120},limits:{activeJobs:1,activeTurns:1,transportAttempts:3,correctionCycles:3,turnSeconds:3600,jobSeconds:21600},pollSeconds:60,projects:[{id:'prime-mover',name:'Prime Mover',repository:'talaniz/prime-mover',baseBranch:'main',maintainers:['talaniz'],enabled:true,setup:[['npm','ci']],verify:[['npm','run','check']],requiredChecks:[],allowedPaths:['src','test']},{id:'doom-dashboard',name:'DOOM Dashboard',repository:'talaniz/doom-control',baseBranch:'main',maintainers:['talaniz'],enabled:true,setup:[['npm','ci']],verify:[['npm','test']],requiredChecks:[],allowedPaths:['server.mjs','dist','test']}]});
test('valid two-project configuration round trips',()=>assert.deepEqual(validateConfig(fixture()),fixture()));
for (const [name,edit] of [
 ['unsafe storage root',c=>c.storage.root='/home/user/data'],
 ['relative socket',c=>c.appServer.socket='codex.sock'],
 ['root filesystem mount',c=>c.storage.mount='/'],
 ['missing UUID',c=>c.storage.uuid=''],
 ['traversing allowed path',c=>c.projects[0].allowedPaths=['../private']],
 ['empty maintainers',c=>c.projects[0].maintainers=[]],
 ['missing verification',c=>c.projects[0].verify=[]],
 ['duplicate repository',c=>c.projects[1].repository=c.projects[0].repository],
 ['duplicate ID',c=>c.projects[1].id=c.projects[0].id],
 ['repository URL injection',c=>c.projects[0].repository='https://evil.invalid/x/y'],
 ['unsafe base branch',c=>c.projects[0].baseBranch='--upload-pack=evil'],
 ['shell command string',c=>c.projects[0].verify=['npm test']],
 ['parallel jobs',c=>c.limits.activeJobs=2],
 ['parallel turns',c=>c.limits.activeTurns=2],
 ['zero deadline',c=>c.limits.turnSeconds=0],
 ['invalid schema',c=>c.schemaVersion=99],
 ['unknown secret field',c=>c.secret='sensitive-value']
]) test(`rejects ${name}`,()=>{const c=fixture();edit(c);assert.throws(()=>validateConfig(c),/configuration/i);});
test('requires compatible installed protocol',()=>{assert.doesNotThrow(()=>validateCapabilities({version:'0.155.1',methods:['thread/start','thread/resume','thread/read','thread/turns/list','turn/start','turn/interrupt'],autoReview:true}));assert.throws(()=>validateCapabilities({version:'0.1',methods:[],autoReview:false}),/protocol/i);});
test('missing credentials fail without echoing credential values',()=>{assert.throws(()=>validateCredentials({github:false,appServer:true,metadataToken:false}),/credentials/i);assert.doesNotThrow(()=>validateCredentials({github:true,appServer:true,metadataToken:true}));});
test('credential shape cannot omit required access checks',()=>assert.throws(()=>validateCredentials({}),/credentials/i));
test('all required protocol features must be explicitly present',()=>assert.throws(()=>validateCapabilities({version:'0.155.1',autoReview:true}),/protocol/i));
test('explicit worker Git author is validated without changing older read-only configs',()=>{const c=fixture();c.gitAuthor={name:'Prime Mover',email:'prime-mover@localhost'};assert.deepEqual(validateConfig(c).gitAuthor,c.gitAuthor);c.gitAuthor.email='not an email';assert.throws(()=>validateConfig(c),/gitAuthor/);});
test('optional storage reserve is explicit and older configurations remain unchanged',()=>{const c=fixture();c.storage.minFreeBytes=536870912;assert.equal(validateConfig(c).storage.minFreeBytes,536870912);for(const n of [0,-1,NaN,1.5]){c.storage.minFreeBytes=n;assert.throws(()=>validateConfig(c),/configuration/i);}});
