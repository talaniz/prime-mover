import path from 'node:path';

export interface ProjectConfig {
  id: string; name: string; repository: string; baseBranch: string;
  maintainers: string[]; enabled: boolean; setup: string[][]; verify: string[][];
  requiredChecks: string[]; allowedPaths: string[];
}
export interface Config {
  schemaVersion: 1;
  gitAuthor?: {name: string; email: string};
  storage: {mount: string; uuid: string; root: string; minFreeBytes?: number};
  appServer: {socket: string; version: string};
  metadata: {socket: string; tokenFile: string; freshnessSeconds: number};
  limits: {activeJobs: 1; activeTurns: 1; transportAttempts: number; correctionCycles: number; turnSeconds: number; jobSeconds: number};
  pollSeconds: number; projects: ProjectConfig[];
}
export const PROTOCOL_VERSION = '0.155.1';
export const REQUIRED_METHODS = ['thread/start', 'thread/resume', 'thread/read', 'thread/turns/list', 'turn/start', 'turn/interrupt'] as const;
function invalid(field: string): never { throw new Error(`Invalid configuration: ${field}`); }
function record(value: unknown, keys: string[], field: string, optional: string[] = []): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(field);
  const r = value as Record<string, unknown>;
  if (Object.keys(r).some(k => !keys.includes(k) && !optional.includes(k)) || keys.some(k => !(k in r))) invalid(`${field} fields`);
  return r;
}
function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim() || /[\x00-\x1f\x7f]/.test(value)) invalid(field);
  return value;
}
function positive(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) invalid(field);
  return value;
}
function absolute(value: unknown, field: string): string {
  const s = text(value, field);
  if (!path.isAbsolute(s) || path.normalize(s) !== s || s === '/') invalid(field);
  return s;
}
function strings(value: unknown, field: string, nonempty = true): string[] {
  if (!Array.isArray(value) || (nonempty && !value.length)) invalid(field);
  const list = value.map(v => text(v, field));
  if (new Set(list).size !== list.length) invalid(`${field} duplicates`);
  return list;
}
function commands(value: unknown, field: string, nonempty: boolean): string[][] {
  if (!Array.isArray(value) || (nonempty && !value.length)) invalid(field);
  return value.map(v => {
    if (!Array.isArray(v) || !v.length) invalid(field);
    return v.map(arg => text(arg, field));
  });
}
export function isWithin(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}
export function validateConfig(value: unknown): Config {
  const c = record(value, ['schemaVersion','storage','appServer','metadata','limits','pollSeconds','projects'], 'root', ['gitAuthor']);
  let gitAuthor: Config['gitAuthor'];
  if (Object.hasOwn(c, 'gitAuthor')) {
    const author = record(c.gitAuthor, ['name','email'], 'gitAuthor');
    gitAuthor = {name:text(author.name,'gitAuthor.name'),email:text(author.email,'gitAuthor.email')};
    if (gitAuthor.name.length>100 || /[<>]/.test(gitAuthor.name) || gitAuthor.email.length>254 || !/^[^\s<>@]+@[^\s<>@]+$/.test(gitAuthor.email)) invalid('gitAuthor');
  }
  if (c.schemaVersion !== 1) invalid('schemaVersion');
  const s = record(c.storage, ['mount','uuid','root'], 'storage', ['minFreeBytes']);
  const storage = {mount:absolute(s.mount,'storage.mount'),uuid:text(s.uuid,'storage.uuid'),root:absolute(s.root,'storage.root'),...(Object.hasOwn(s,'minFreeBytes') ? {minFreeBytes:positive(s.minFreeBytes,'storage.minFreeBytes')} : {})};
  if (!isWithin(storage.mount, storage.root)) invalid('storage.root must be below mount');
  const a = record(c.appServer,['socket','version'],'appServer');
  const appServer = {socket:absolute(a.socket,'appServer.socket'),version:text(a.version,'appServer.version')};
  const m = record(c.metadata,['socket','tokenFile','freshnessSeconds'],'metadata');
  const metadata = {socket:absolute(m.socket,'metadata.socket'),tokenFile:absolute(m.tokenFile,'metadata.tokenFile'),freshnessSeconds:positive(m.freshnessSeconds,'metadata.freshnessSeconds')};
  if (!isWithin(storage.root, metadata.socket)) invalid('metadata.socket must be below storage.root');
  const l = record(c.limits,['activeJobs','activeTurns','transportAttempts','correctionCycles','turnSeconds','jobSeconds'],'limits');
  if (l.activeJobs !== 1 || l.activeTurns !== 1) invalid('global concurrency must be one job and one turn');
  const limits: Config['limits'] = {activeJobs:1,activeTurns:1,transportAttempts:positive(l.transportAttempts,'limits.transportAttempts'),correctionCycles:positive(l.correctionCycles,'limits.correctionCycles'),turnSeconds:positive(l.turnSeconds,'limits.turnSeconds'),jobSeconds:positive(l.jobSeconds,'limits.jobSeconds')};
  if (limits.jobSeconds < limits.turnSeconds) invalid('job deadline shorter than turn deadline');
  if (!Array.isArray(c.projects) || c.projects.length === 0) invalid('projects');
  const projects = c.projects.map((v): ProjectConfig => {
    const p = record(v,['id','name','repository','baseBranch','maintainers','enabled','setup','verify','requiredChecks','allowedPaths'],'project');
    const id = text(p.id,'project.id');
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(id)) invalid('project.id');
    const repository = text(p.repository,'project.repository');
    if (!/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(repository) || repository.endsWith('.git')) invalid('project.repository');
    const baseBranch = text(p.baseBranch,'project.baseBranch');
    if (!/^[A-Za-z0-9][A-Za-z0-9_./-]*$/.test(baseBranch) || baseBranch.includes('..') || baseBranch.includes('//') || /[/.]$/.test(baseBranch) || baseBranch.endsWith('.lock')) invalid('project.baseBranch');
    const maintainers = strings(p.maintainers,'project.maintainers');
    if (maintainers.some(x => !/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(x))) invalid('project.maintainers');
    if (typeof p.enabled !== 'boolean') invalid('project.enabled');
    const allowedPaths = strings(p.allowedPaths,'project.allowedPaths');
    if (allowedPaths.some(x => path.isAbsolute(x) || x.split('/').some(y => y === '..' || y === '.' || y === '') || x.includes('\\'))) invalid('project.allowedPaths');
    return {id,name:text(p.name,'project.name'),repository,baseBranch,maintainers,enabled:p.enabled,setup:commands(p.setup,'project.setup',false),verify:commands(p.verify,'project.verify',true),requiredChecks:strings(p.requiredChecks,'project.requiredChecks',false),allowedPaths};
  });
  for (const field of ['id','repository'] as const) if (new Set(projects.map(p => p[field].toLowerCase())).size !== projects.length) invalid(`duplicate project ${field}`);
  return {schemaVersion:1,...(gitAuthor ? {gitAuthor} : {}),storage,appServer,metadata,limits,pollSeconds:positive(c.pollSeconds,'pollSeconds'),projects};
}
export function validateCapabilities(value: {version: string; methods: readonly string[]; autoReview: boolean}): void {
  if (!value || value.version !== PROTOCOL_VERSION || value.autoReview !== true || !Array.isArray(value.methods) || REQUIRED_METHODS.some(m => !value.methods.includes(m))) {
    throw new Error(`Unsupported app-server protocol; validate Codex ${PROTOCOL_VERSION}, lifecycle/history methods and auto_review before execution`);
  }
}
export function validateCredentials(value: {github: boolean; appServer: boolean; metadataToken: boolean}): void {
  const missing = (['github','appServer','metadataToken'] as const).filter(name => value?.[name] !== true);
  if (missing.length) throw new Error(`Missing credentials or authenticated access: ${missing.join(', ')}`);
}
