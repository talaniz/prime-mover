import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('Pi SQLite driver supports WAL transactions, rollback and reopened integrity',()=>{
 const dir=mkdtempSync(join(tmpdir(),'pm-sqlite-'));const p=join(dir,'probe.db');let a,b;
 try{a=new DatabaseSync(p);a.exec('PRAGMA journal_mode=WAL; CREATE TABLE probe (id INTEGER PRIMARY KEY, value TEXT)');b=new DatabaseSync(p);a.exec('BEGIN IMMEDIATE');a.prepare('INSERT INTO probe VALUES (?,?)').run(1,'durable');assert.equal(b.prepare('SELECT count(*) n FROM probe').get().n,0);a.exec('COMMIT');assert.equal(b.prepare('SELECT value FROM probe').get().value,'durable');a.exec('BEGIN IMMEDIATE; DELETE FROM probe; ROLLBACK');b.close();b=undefined;a.close();a=new DatabaseSync(p);assert.equal(a.prepare('SELECT count(*) n FROM probe').get().n,1);assert.equal(a.prepare('PRAGMA integrity_check').get().integrity_check,'ok');}finally{a?.close();b?.close();rmSync(dir,{recursive:true,force:true});}
});
