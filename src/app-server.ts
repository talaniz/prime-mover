import {EventEmitter} from 'node:events';
import WebSocket from 'ws';

type Pending = {resolve: (value: unknown) => void; reject: (error: Error) => void; timer: NodeJS.Timeout};
export interface RpcNotification {id?: string | number; method: string; params?: unknown}
/** One connection to the existing daemon; transport never retries side effects. */
export class AppServer extends EventEmitter {
  private ws: WebSocket | undefined;
  private pending = new Map<number, Pending>();
  private nextId = 1;
  constructor(private readonly socket: string, private readonly timeoutMs = 10000) { super(); }
  async connect(): Promise<void> {
    if (this.ws) throw new Error('App-server client already connected; create a new client to reconcile');
    const ws = new WebSocket(`ws+unix://${this.socket}:/`, {headers:{Host:'localhost'},perMessageDeflate:false,handshakeTimeout:this.timeoutMs,maxPayload:16*1024*1024});
    this.ws = ws;
    ws.on('message', raw => {
      let m: {id?: number; method?: string; params?: unknown; result?: unknown; error?: {code?: number}};
      try { m = JSON.parse(raw.toString()); } catch { this.fail('Invalid app-server message; reconcile'); ws.close(); return; }
      if (!m || typeof m !== 'object') { this.fail('Invalid app-server message; reconcile'); ws.close(); return; }
      if (m.method) { this.emit('notification', m); return; }
      if (typeof m.id !== 'number') return;
      const p = this.pending.get(m.id);
      if (!p) return;
      clearTimeout(p.timer); this.pending.delete(m.id);
      // Provider errors may embed prompts, commands or credentials. Never reflect them.
      if (m.error) p.reject(new Error(`App-server RPC error (${m.error.code ?? 'unknown'}); inspect redacted diagnostics and reconcile`));
      else p.resolve(m.result);
    });
    ws.on('close', () => { this.fail('App-server disconnected; reconcile before retry'); this.emit('disconnected'); });
    ws.on('error', () => this.fail('App-server connection failed; reconcile before retry'));
    await new Promise<void>((resolve,reject) => {
      ws.once('open',resolve); ws.once('error',() => reject(new Error('App-server connection failed')));
      ws.once('close',() => reject(new Error('App-server disconnected during connection')));
    });
    try {
      await this.request('initialize',{clientInfo:{name:'prime_mover',title:'Prime Mover',version:'0.1.0'},capabilities:{experimentalApi:true}});
      ws.send(JSON.stringify({method:'initialized'}));
    } catch (error) { this.close(); throw error; }
  }
  request(method: string, params: unknown = {}): Promise<unknown> {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return Promise.reject(new Error('App-server disconnected; reconcile before retry'));
    return new Promise((resolve,reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('App-server request timed out; reconcile before retry')); },this.timeoutMs);
      this.pending.set(id,{resolve,reject,timer});
      ws.send(JSON.stringify({id,method,params}), error => {
        if (error) { clearTimeout(timer); this.pending.delete(id); reject(new Error('App-server send failed; reconcile before retry')); }
      });
    });
  }
  private fail(message: string): void {
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error(message)); }
    this.pending.clear();
  }
  close(): void { this.fail('App-server disconnected; reconcile before retry'); this.ws?.close(); }
}
export function threadOptions(cwd: string) {
  return {cwd,approvalPolicy:'on-request' as const,approvalsReviewer:'auto_review' as const,sandbox:'workspace-write' as const,ephemeral:false};
}
export function classifyThread(thread: unknown): 'idle' | 'active' | 'waiting' | 'blocked' | 'unknown' {
  const t = thread as {status?: {type?: string; activeFlags?: string[]}} | null;
  const s = t?.status;
  if (s?.type === 'idle') return 'idle';
  if (s?.type === 'systemError') return 'blocked';
  if (s?.type === 'active') return s.activeFlags?.some(x => x === 'waitingOnApproval' || x === 'waitingOnUserInput') ? 'waiting' : 'active';
  return 'unknown';
}
