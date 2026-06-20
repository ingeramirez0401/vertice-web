import type { SupabaseClient } from '@supabase/supabase-js';

export type NodeStatus = 'activo' | 'nuevo' | 'inactivo';
export type LayoutMode = 'radial' | 'tree' | 'force';
export type ThemeKey = 'cian' | 'violeta' | 'neon' | 'claro';

export interface GraphNode {
  uid: string;
  id: number;
  parentUid: string | null;
  parent: number;
  depth: number;
  children: number[];
  name: string;
  idCode: string;
  status: NodeStatus;
  desc: number;
  x: number; y: number;
  tx: number; ty: number;
  vx: number; vy: number;
  visible: boolean;
  collapsed: boolean;
  born: number;
  isMe?: boolean;
  verified?: boolean;
  municipio?: string;
  cedula?: string;
  _a?: number;
  _b?: number;
}

export interface Theme {
  bg: string; bg2: string;
  accent: string; accent2: string;
  text: string; muted: string;
  border: string; panel: string;
}

export const MUNI_COLORS: Record<string, string> = {
  'Cúcuta':            '#27e0c8',
  'Villa del Rosario': '#5b9bff',
  'Los Patios':        '#b06cff',
  'Ocaña':             '#ff6b35',
  'Pamplona':          '#ffd86b',
  'Tibú':              '#3dff9a',
  'El Zulia':          '#ff5db0',
  'Sardinata':         '#8effb4',
  'Ábrego':            '#ff9b42',
  'Chinácota':         '#c8ff57',
  'Puerto Santander':  '#57d4ff',
  'San Cayetano':      '#ff8fab',
};

export const THEMES: Record<ThemeKey, Theme> = {
  cian:    { bg:'#05070d',bg2:'#0b1422',accent:'#27e0c8',accent2:'#5b9bff',text:'#dbeee9',muted:'#7c8a92',border:'rgba(120,200,210,.16)',panel:'rgba(9,14,22,.74)' },
  violeta: { bg:'#0a0612',bg2:'#160a26',accent:'#b06cff',accent2:'#ff5db0',text:'#ece4f6',muted:'#8a7d97',border:'rgba(176,108,255,.18)',panel:'rgba(15,9,26,.76)' },
  neon:    { bg:'#04120d',bg2:'#082018',accent:'#3dff9a',accent2:'#d6ff3a',text:'#d9f6e6',muted:'#6e8a7c',border:'rgba(61,255,154,.16)',panel:'rgba(7,20,15,.76)' },
  claro:   { bg:'#e9e7df',bg2:'#f3f1ea',accent:'#0c8f78',accent2:'#3a6df0',text:'#1a2620',muted:'#6a766f',border:'rgba(12,40,33,.16)',panel:'rgba(255,255,255,.78)' },
};

const ROLES = ['Candidato','Coordinador Municipal','Líder de Puesto','Promotor','Simpatizante'];
export const roleForDepth = (d: number) => ROLES[Math.min(d, ROLES.length - 1)];

export class MeshEngine {
  nodes: GraphNode[] = [];
  meId = -1;
  selId = -1;
  themeKey: ThemeKey = 'cian';
  mode: LayoutMode = 'radial';
  view: 'global' | 'personal' = 'global';
  colorMode: 'status' | 'municipio' = 'status';
  live = true;

  onSelect?: (id: number) => void;
  onToast?: (msg: string) => void;
  onUpdate?: () => void;

  private canvas!: HTMLCanvasElement;
  private cam = { x:0, y:0, s:1 };
  private camGoal = { x:0, y:0, s:1 };
  private dragging = false;
  private moved = 0;
  private last = { x:0, y:0 };
  private hoverId = -1;
  private _ptrs = new Map<number, {x:number;y:number}>();
  private _pinch = { dist:0, scale:1, cx:0, cy:0, camX:0, camY:0 };
  private _uiFont = '"Plus Jakarta Sans", system-ui, sans-serif';
  private chain = new Set<number>();
  private _t0 = 0;
  private cssW = 1280;
  private cssH = 760;
  private dpr = 1;
  private parts: Array<{x:number;y:number;vx:number;vy:number;r:number;a:number}> = [];
  private _raf = 0;
  private _resizeHandler?: () => void;
  private _isMobile = false;
  private _fpsCap = 60;
  private _lastDraw = 0;
  private _filterSet: Set<number> | null = null;
  private _filterPrimary: Set<number> | null = null;

  init(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this._t0 = performance.now();
    this._isMobile = window.innerWidth < 768;
    this.dpr = Math.min(window.devicePixelRatio || 1, this._isMobile ? 1.5 : 2);
    this._fpsCap = this._isMobile ? 30 : 60;
    try {
      const fv = getComputedStyle(document.body).getPropertyValue('--font-space').trim();
      if (fv) this._uiFont = fv;
    } catch { /* SSR guard */ }
    this._resize();
    this._wire();
    const partCount = this._isMobile ? 20 : 70;
    this.parts = Array.from({ length: partCount }, () => ({
      x: Math.random(), y: Math.random(),
      vx: (Math.random() - .5) * 0.00006, vy: (Math.random() - .5) * 0.00006,
      r: Math.random() * 1.4 + 0.3, a: Math.random() * 0.4 + 0.1,
    }));
  }

  async loadGraph(supabase: SupabaseClient, userId: string): Promise<void> {
    const { data, error } = await supabase
      .from('vtx_members')
      .select('id,parent_id,full_name,adhesion_code,status,depth,child_count,subtree_size,verified,municipio,cedula')
      .order('depth', { ascending: true });

    if (error || !data?.length) return;

    const idx = new Map<string, GraphNode>();
    this.nodes = data.map((m, i) => {
      const n: GraphNode = {
        uid: m.id, id: i, parentUid: m.parent_id, parent: -1,
        depth: m.depth, children: [], name: m.full_name, idCode: m.adhesion_code,
        status: m.status as NodeStatus, desc: m.subtree_size ?? 0,
        x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0,
        visible: true, collapsed: false, born: 0,
        verified: m.verified ?? false,
        municipio: m.municipio ?? undefined,
        cedula: m.cedula ?? undefined,
      };
      idx.set(m.id, n);
      return n;
    });

    this.nodes.forEach(n => {
      if (n.parentUid && idx.has(n.parentUid)) {
        const p = idx.get(n.parentUid)!;
        n.parent = p.id;
        p.children.push(n.id);
      }
    });

    const { data: meRows } = await supabase
      .from('vtx_members').select('id').eq('user_id', userId).limit(1);
    const meRow = meRows?.[0];
    if (meRow) {
      const myNode = this.nodes.find(n => n.uid === meRow.id);
      if (myNode) { myNode.isMe = true; this.meId = myNode.id; }
    }

    this._layout(true);
    if (this._isMobile) {
      for (const n of this.nodes) {
        if (n.children.length > 0 && n.depth >= 3) n.collapsed = true;
      }
      this._layout(true);
    }
    this.fitView(false);
    this.onUpdate?.();
  }

  onRemoteJoin(row: Record<string, unknown>): void {
    const parent = this.nodes.find(n => n.uid === row.parent_id);
    if (!parent) return;
    const n: GraphNode = {
      uid: row.id as string, id: this.nodes.length,
      parentUid: row.parent_id as string, parent: parent.id,
      depth: (row.depth as number) ?? parent.depth + 1, children: [],
      name: row.full_name as string, idCode: row.adhesion_code as string,
      status: 'nuevo', desc: 0,
      x: parent.x, y: parent.y, tx: parent.x, ty: parent.y,
      vx: 0, vy: 0, visible: true, collapsed: false, born: performance.now(),
    };
    parent.children.push(n.id);
    this.nodes.push(n);
    let p: GraphNode | undefined = parent;
    while (p) { p.desc = (p.desc || 0) + 1; p = p.parent >= 0 ? this.nodes[p.parent] : undefined; }
    this._layout(false);
    this.onUpdate?.();
  }

  setFilter(status: NodeStatus | null, municipio: string | null): void {
    if (!status && !municipio) {
      this._filterSet = null;
      this._filterPrimary = null;
    } else {
      const full    = new Set<number>();
      const primary = new Set<number>();
      for (const n of this.nodes) {
        const matchStatus = !status    || n.status    === status;
        const matchMuni   = !municipio || n.municipio === municipio;
        if (matchStatus && matchMuni) {
          full.add(n.id);
          primary.add(n.id);
          let cur = n.parent >= 0 ? this.nodes[n.parent] : undefined;
          while (cur) { full.add(cur.id); cur = cur.parent >= 0 ? this.nodes[cur.parent] : undefined; }
        }
      }
      this._filterSet     = full;
      this._filterPrimary = primary;
    }
    this.onUpdate?.();
  }

  startLoop(): void {
    const interval = 1000 / this._fpsCap;
    const loop = (now: number) => {
      this._raf = requestAnimationFrame(loop);
      if (now - this._lastDraw < interval) return;
      this._lastDraw = now;
      const T = THEMES[this.themeKey];
      this.cam.x += (this.camGoal.x - this.cam.x) * 0.12;
      this.cam.y += (this.camGoal.y - this.cam.y) * 0.12;
      this.cam.s += (this.camGoal.s - this.cam.s) * 0.12;
      if (this.mode === 'force') {
        this._forceStep();
      } else {
        for (const n of this.nodes) {
          if (!n.visible) continue;
          n.x += (n.tx - n.x) * 0.14;
          n.y += (n.ty - n.y) * 0.14;
        }
      }
      try { this._draw(now, T); } catch (_) {}
    };
    this._raf = requestAnimationFrame(loop);
  }

  destroy(): void {
    cancelAnimationFrame(this._raf);
    if (this._resizeHandler) window.removeEventListener('resize', this._resizeHandler);
  }

  // --- layout ---

  private _layout(immediate: boolean): void {
    const { nodes } = this;
    nodes.forEach(n => { n.visible = false; });
    let leaf = 0;
    const ring = 190, ygap = 140, xgap = 50;
    const root = nodes[0];
    if (!root) return;

    const pass = (n: GraphNode) => {
      n.visible = true;
      const kids = n.collapsed ? [] : n.children;
      if (!kids.length) { n._a = leaf; n._b = leaf + 1; leaf++; return; }
      const s = leaf;
      for (const k of kids) pass(nodes[k]);
      n._a = s; n._b = leaf;
    };
    pass(root);

    const L = Math.max(1, leaf);
    for (const n of nodes) {
      if (!n.visible) continue;
      const c = ((n._a ?? 0) + (n._b ?? 0)) / 2;
      if (this.mode === 'tree') {
        n.tx = (c - L / 2) * xgap; n.ty = n.depth * ygap - 260;
      } else {
        const ang = (c / L) * Math.PI * 2 - Math.PI / 2;
        const rad = n.depth * ring;
        n.tx = Math.cos(ang) * rad; n.ty = Math.sin(ang) * rad;
      }
    }
    if (immediate) for (const n of nodes) { if (n.visible) { n.x = n.tx; n.y = n.ty; } }
    if (this.mode === 'force') for (const n of nodes) { if (n.visible && n.x === 0 && n.y === 0) { n.x = n.tx; n.y = n.ty; } }
  }

  private _forceStep(): void {
    const vis = this.nodes.filter(n => n.visible);
    const k = 1700, spring = 145, damp = 0.86;
    for (let i = 0; i < vis.length; i++) {
      const a = vis[i];
      for (let j = i + 1; j < vis.length; j++) {
        const b = vis[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) d2 = 1;
        if (d2 > 52000) continue;
        const f = k / d2, d = Math.sqrt(d2);
        const fx = dx / d * f, fy = dy / d * f;
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      }
    }
    for (const n of vis) {
      if (n.parent < 0) continue;
      const p = this.nodes[n.parent];
      if (!p?.visible) continue;
      const dx = p.x - n.x, dy = p.y - n.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - spring) * 0.012;
      n.vx += dx / d * f; n.vy += dy / d * f;
      p.vx -= dx / d * f * 0.5; p.vy -= dy / d * f * 0.5;
    }
    for (const n of vis) {
      n.vx -= n.x * 0.0006; n.vy -= n.y * 0.0006;
      n.vx *= damp; n.vy *= damp;
      if (n.parent < 0) { n.x = 0; n.y = 0; n.vx = 0; n.vy = 0; continue; }
      n.x += n.vx; n.y += n.vy;
    }
  }

  // --- camera ---

  worldToScreen(wx: number, wy: number): [number, number] {
    return [wx * this.cam.s + this.cam.x, wy * this.cam.s + this.cam.y];
  }

  fitView(animate: boolean): void {
    const vis = this.nodes.filter(n => n.visible);
    if (!vis.length) return;
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    for (const n of vis) {
      minx = Math.min(minx, n.tx || n.x); miny = Math.min(miny, n.ty || n.y);
      maxx = Math.max(maxx, n.tx || n.x); maxy = Math.max(maxy, n.ty || n.y);
    }
    const spanx = Math.max(200, maxx - minx), spany = Math.max(200, maxy - miny);
    const s = Math.min(this.cssW / (spanx + 260), this.cssH / (spany + 260));
    const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
    const sc = Math.max(0.12, Math.min(1.4, s));
    const goal = { s: sc, x: this.cssW / 2 - cx * sc, y: this.cssH / 2 - cy * sc };
    this.camGoal = goal;
    if (!animate) this.cam = { ...goal };
  }

  centerOn(id: number, scale?: number): void {
    const n = this.nodes[id]; if (!n) return;
    const s = scale || Math.max(this.cam.s, 0.72);
    this.camGoal = { s, x: this.cssW / 2 - (n.tx || n.x) * s, y: this.cssH * 0.46 - (n.ty || n.y) * s };
  }

  // --- interaction ---

  select(id: number): void {
    const n = this.nodes[id]; if (!n) return;
    this.selId = id;
    this.chain = new Set([id, ...this.ancestorsOf(id)]);
    this.centerOn(id);
    this.onSelect?.(id);
  }

  clearSel(): void {
    this.selId = -1;
    this.chain = new Set();
    this.onSelect?.(-1);
  }

  toggleCollapse(id: number): void {
    const n = this.nodes[id]; if (!n || !n.children.length) return;
    n.collapsed = !n.collapsed;
    this._layout(false);
    this.onUpdate?.();
  }

  setMode(mode: LayoutMode): void {
    this.mode = mode;
    this._layout(false);
    setTimeout(() => this.fitView(true), 60);
    this.onUpdate?.();
  }

  setView(v: 'global' | 'personal'): void {
    this.view = v;
    if (v === 'personal' && this.meId >= 0) {
      this.select(this.meId);
      this.centerOn(this.meId, 0.8);
    } else {
      this.clearSel();
      this.fitView(true);
    }
    this.onUpdate?.();
  }

  setTheme(key: ThemeKey): void {
    this.themeKey = key;
  }

  getTheme(): Theme {
    return THEMES[this.themeKey];
  }

  // --- tree helpers ---

  ancestorsOf(id: number): number[] {
    const arr: number[] = [];
    let n = this.nodes[id];
    while (n && n.parent >= 0) { arr.unshift(n.parent); n = this.nodes[n.parent]; }
    return arr;
  }

  descSet(id: number): Set<number> {
    const set = new Set<number>();
    const st = [id];
    while (st.length) {
      const k = st.pop()!;
      for (const c of this.nodes[k].children) { set.add(c); st.push(c); }
    }
    return set;
  }

  // --- node helpers ---

  initials(n: GraphNode): string {
    const p = n.name.split(' ');
    return ((p[0] || '')[0] || '') + ((p[1] || '')[0] || '');
  }

  nodeColor(n: GraphNode): string {
    const T = THEMES[this.themeKey];
    if (n.depth === 0) return '#ffd86b';
    if (this.colorMode === 'municipio') {
      if (n.municipio && MUNI_COLORS[n.municipio]) return MUNI_COLORS[n.municipio];
      return T.muted;
    }
    if (n.status === 'inactivo') return T.bg === '#e9e7df' ? '#9aa39c' : '#3a434c';
    if (n.status === 'nuevo') return T.accent2;
    return T.accent;
  }

  statusLabel(n: GraphNode): string {
    if (n.status === 'nuevo') return 'Nuevo ingreso';
    if (n.status === 'inactivo') return 'Inactivo';
    return 'Activo';
  }

  search(q: string) {
    if (!q.trim()) return [];
    const ql = q.toLowerCase();
    return this.nodes
      .filter(n => n.name.toLowerCase().includes(ql) || n.idCode.toLowerCase().includes(ql))
      .slice(0, 6)
      .map(n => ({
        name: n.name, initials: this.initials(n), color: this.nodeColor(n),
        roleLabel: roleForDepth(n.depth), depth: n.depth, idCode: n.idCode, nodeId: n.id,
      }));
  }

  buildSel(id: number) {
    const n = this.nodes[id]; if (!n) return null;
    const anc = this.ancestorsOf(id).map(a => ({ name: this.nodes[a].name.split(' ')[0], nodeId: a }));
    const kids = n.children.map(k => this.nodes[k]);
    const shown = kids.slice(0, 8).map(k => ({
      name: k.name, initials: this.initials(k), color: this.nodeColor(k),
      roleLabel: roleForDepth(k.depth), descCount: k.desc || 0, nodeId: k.id,
    }));
    const origin = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || '');
    return {
      name: n.name, initials: this.initials(n), color: this.nodeColor(n),
      roleLabel: roleForDepth(n.depth), idCode: n.idCode,
      depth: n.depth, childrenCount: n.children.length,
      descCount: n.desc || 0, statusLabel: this.statusLabel(n),
      isMe: !!n.isMe, hasParent: n.parent >= 0, parentId: n.parent,
      parentName: n.parent >= 0 ? this.nodes[n.parent].name : '—',
      ancestors: anc, hasChildren: n.children.length > 0, children: shown,
      moreChildren: Math.max(0, (n.desc || 0) - n.children.length),
      collapsed: n.collapsed,
      municipio: n.municipio ?? null,
      cedula: n.cedula ? ('****' + n.cedula.slice(-4)) : null,
      shareLink: `${origin}/unirse/${n.idCode}`,
      muniColor: n.municipio ? (MUNI_COLORS[n.municipio] ?? null) : null,
    };
  }

  buildMe() {
    const me = this.nodes[this.meId]; if (!me) return null;
    const appUrl = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || '');
    return {
      name: me.name, initials: this.initials(me),
      roleLabel: roleForDepth(me.depth),
      idCode: me.idCode, descCount: me.desc || 0,
      childrenCount: me.children.length,
      nodeId: me.id,
      link: `${appUrl}/unirse/${me.idCode}`,
      verified: me.verified ?? false,
      municipio: me.municipio ?? null,
      muniColor: me.municipio ? (MUNI_COLORS[me.municipio] ?? null) : null,
    };
  }

  getStats() {
    if (!this.nodes.length) return { total: 0, maxDepth: 0, ramas: 0, nuevos: 0 };
    let maxDepth = 0, nuevos = 0;
    for (const n of this.nodes) {
      if (n.visible && n.depth > maxDepth) maxDepth = n.depth;
      if (n.status === 'nuevo') nuevos++;
    }
    return { total: this.nodes.length, maxDepth, ramas: this.nodes[0]?.children.length ?? 0, nuevos };
  }

  // --- draw ---

  private _draw(now: number, T: Theme): void {
    const c = this.canvas; if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.cssW, this.cssH);
    const time = (now - this._t0) / 1000;
    const sel = this.selId >= 0;
    const lowZoom = this.cam.s < 0.35;
    const veryLowZoom = this.cam.s < 0.12;
    const inView = (x: number, y: number) => x > -120 && x < this.cssW + 120 && y > -120 && y < this.cssH + 120;
    let focus: Set<number> | null = null;
    if (this.view === 'personal' && this.meId >= 0) {
      focus = this.descSet(this.meId);
      focus.add(this.meId);
      for (const a of this.ancestorsOf(this.meId)) focus.add(a);
    }

    // ambient particles — skip at low zoom to save fill ops
    if (!lowZoom) {
      ctx.globalCompositeOperation = 'lighter';
      for (const p of this.parts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = 1; if (p.x > 1) p.x = 0;
        if (p.y < 0) p.y = 1; if (p.y > 1) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x * this.cssW, p.y * this.cssH, p.r, 0, 6.28);
        ctx.fillStyle = `rgba(${this._rgb(T.accent)},${p.a * 0.5})`;
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    } else {
      // still move particles so they resume naturally when zooming in
      for (const p of this.parts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = 1; if (p.x > 1) p.x = 0;
        if (p.y < 0) p.y = 1; if (p.y > 1) p.y = 0;
      }
    }

    const dim = (id: number): number => {
      if (this.nodes[id]?.depth === 0) return 1;
      if (this._filterSet && !this._filterSet.has(id)) return 0.05;
      if (sel) return this.chain.has(id) ? 1 : 0.2;
      if (focus) return focus.has(id) ? 1 : 0.16;
      if (this._filterSet && this._filterPrimary && !this._filterPrimary.has(id)) return 0.28;
      return 1;
    };

    // edges
    ctx.globalCompositeOperation = 'source-over';
    for (const n of this.nodes) {
      if (!n.visible || n.parent < 0) continue;
      const p = this.nodes[n.parent]; if (!p?.visible) continue;
      const [x1, y1] = this.worldToScreen(p.x, p.y);
      const [x2, y2] = this.worldToScreen(n.x, n.y);
      if (!inView(x1, y1) && !inView(x2, y2)) continue; // viewport cull
      const onChain = sel && this.chain.has(n.id) && this.chain.has(p.id);
      const al = Math.min(dim(n.id), dim(p.id));
      if (lowZoom) {
        // fast flat line — no gradient creation
        ctx.strokeStyle = `rgba(${this._rgb(onChain ? T.accent2 : T.accent)},${0.18 * al})`;
        ctx.lineWidth = onChain ? 1.4 : 0.6;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        continue;
      }
      const g = ctx.createLinearGradient(x1, y1, x2, y2);
      const ca = onChain ? T.accent2 : this.nodeColor(p);
      const cb = onChain ? T.accent2 : this.nodeColor(n);
      g.addColorStop(0, `rgba(${this._rgb(ca)},${0.34 * al})`);
      g.addColorStop(1, `rgba(${this._rgb(cb)},${0.10 * al})`);
      ctx.strokeStyle = g;
      ctx.lineWidth = (onChain ? 2.2 : Math.max(0.5, 1.4 - n.depth * 0.12)) * Math.max(0.4, this.cam.s);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      if (al > 0.3 && this.cam.s > 0.22) {
        const sp = onChain ? 0.7 : 0.28;
        const t = ((time * sp + (n.id % 10) * 0.13) % 1);
        const px = x1 + (x2 - x1) * t, py = y1 + (y2 - y1) * t;
        const pr = (onChain ? 2.6 : 1.7) * Math.max(0.5, this.cam.s);
        const pcol = onChain ? T.accent2 : T.accent;
        ctx.beginPath(); ctx.arc(px, py, pr, 0, 6.28);
        ctx.fillStyle = `rgba(${this._rgb(pcol)},${0.9 * al})`; ctx.fill();
        ctx.beginPath(); ctx.arc(px, py, pr * 3, 0, 6.28);
        ctx.fillStyle = `rgba(${this._rgb(pcol)},${0.12 * al})`; ctx.fill();
      }
    }

    // node halos — skip entirely at very low zoom
    if (!veryLowZoom) {
      ctx.globalCompositeOperation = 'lighter';
      for (const n of this.nodes) {
        if (!n.visible) continue;
        const [x, y] = this.worldToScreen(n.x, n.y);
        if (!inView(x, y)) continue;
        const r = this._rad(n) * this.cam.s;
        const al = dim(n.id);
        const col = this.nodeColor(n);
        const isNew = n.status === 'nuevo';
        const birth = n.born ? Math.min(1, (now - n.born) / 900) : 1;
        if (lowZoom && !isNew && !n.isMe && n.depth > 0) continue; // only root/new halos at low zoom
        const hr = r * (isNew ? 3.4 : 2.4) * (0.85 + 0.15 * Math.sin(time * 2 + n.id));
        const hg = ctx.createRadialGradient(x, y, 0, x, y, hr);
        hg.addColorStop(0, `rgba(${this._rgb(col)},${0.5 * al * birth})`);
        hg.addColorStop(1, `rgba(${this._rgb(col)},0)`);
        ctx.beginPath(); ctx.arc(x, y, hr, 0, 6.28); ctx.fillStyle = hg; ctx.fill();
        if (n.born && birth < 1) {
          ctx.beginPath(); ctx.arc(x, y, r + (1 - birth) * 38, 0, 6.28);
          ctx.strokeStyle = `rgba(${this._rgb(T.accent2)},${0.55 * (1 - birth) * al})`;
          ctx.lineWidth = 2; ctx.stroke();
        }
      }
    }

    // node cores
    ctx.globalCompositeOperation = 'source-over';
    for (const n of this.nodes) {
      if (!n.visible) continue;
      const [x, y] = this.worldToScreen(n.x, n.y);
      if (!inView(x, y)) continue;
      const r = this._rad(n) * this.cam.s;
      const al = dim(n.id);
      const col = this.nodeColor(n);
      const isSel = n.id === this.selId, isHover = n.id === this.hoverId, isMe = n.isMe;
      if (lowZoom && !isSel && !isHover && !isMe && n.depth > 0) {
        // fast flat dot — no gradient, no label
        ctx.globalAlpha = al * 0.85;
        ctx.beginPath(); ctx.arc(x, y, Math.max(2.5, r), 0, 6.28);
        ctx.fillStyle = col; ctx.fill();
        ctx.globalAlpha = 1;
        continue;
      }
      ctx.globalAlpha = al;
      if (isMe || isSel || n.depth === 0) {
        ctx.beginPath(); ctx.arc(x, y, r + 4, 0, 6.28);
        ctx.strokeStyle = col; ctx.lineWidth = isSel ? 2.4 : 1.6;
        ctx.globalAlpha = al * 0.9; ctx.stroke(); ctx.globalAlpha = al;
      }
      const cg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
      cg.addColorStop(0, this._mix(col, '#ffffff', 0.35));
      cg.addColorStop(1, col);
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.28); ctx.fillStyle = cg; ctx.fill();
      if (n.collapsed) {
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        ctx.font = `bold ${Math.max(8, r * 0.9)}px ${this._uiFont}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('+', x, y + 0.5);
      }
      const showLabel = (n.depth <= 1 || isSel || isHover || isMe || (n.children.length >= 4 && this.cam.s > 0.5)) && this.cam.s > 0.2 && al > 0.45;
      if (showLabel) {
        ctx.globalAlpha = al;
        ctx.font = `${n.depth === 0 ? '700 ' : '600 '}${Math.max(10, Math.min(15, 9 + r * 0.4))}px ${this._uiFont}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        const label = isMe ? 'TÚ · ' + n.name.split(' ')[0] : n.name;
        const ty = y + r + 5;
        ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillText(label, x + 0.6, ty + 0.6);
        ctx.fillStyle = T.text; ctx.fillText(label, x, ty);
        if (isSel || isHover) {
          ctx.font = '500 10px IBM Plex Mono';
          ctx.fillStyle = `rgba(${this._rgb(col)},.95)`;
          ctx.fillText(n.idCode, x, ty + Math.max(11, r * 0.4) + 4);
        }
      }
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private _rad(n: GraphNode): number {
    return Math.max(3.5, (n.depth === 0 ? 22 : 15 - n.depth * 1.9)) + Math.min(9, n.children.length * 0.55);
  }

  private _rgb(hex: string): string {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const n = parseInt(hex, 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  }

  private _mix(a: string, b: string, t: number): string {
    const pa = this._rgb(a).split(',').map(Number);
    const pb = this._rgb(b).split(',').map(Number);
    return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',')})`;
  }

  private _wire(): void {
    const c = this.canvas;

    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      this._ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this._ptrs.size === 1) {
        this.dragging = true; this.moved = 0;
        this.last = { x: e.clientX, y: e.clientY };
        c.style.cursor = 'grabbing';
      } else if (this._ptrs.size === 2) {
        this.dragging = false;
        const pts = Array.from(this._ptrs.values());
        const r = c.getBoundingClientRect();
        this._pinch.dist  = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        this._pinch.scale = this.cam.s;
        this._pinch.cx    = (pts[0].x + pts[1].x) / 2 - r.left;
        this._pinch.cy    = (pts[0].y + pts[1].y) / 2 - r.top;
        this._pinch.camX  = this.cam.x;
        this._pinch.camY  = this.cam.y;
      }
    });

    c.addEventListener('pointermove', (e) => {
      this._ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const r = c.getBoundingClientRect();

      if (this._ptrs.size >= 2) {
        const pts = Array.from(this._ptrs.values());
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        const cx   = (pts[0].x + pts[1].x) / 2 - r.left;
        const cy   = (pts[0].y + pts[1].y) / 2 - r.top;
        if (this._pinch.dist > 0) {
          const f  = dist / this._pinch.dist;
          const ns = Math.max(0.08, Math.min(3.2, this._pinch.scale * f));
          const wx = (this._pinch.cx - this._pinch.camX) / this._pinch.scale;
          const wy = (this._pinch.cy - this._pinch.camY) / this._pinch.scale;
          this.cam.s = ns;
          this.cam.x = cx - wx * ns;
          this.cam.y = cy - wy * ns;
          this.camGoal = { ...this.cam };
        }
        return;
      }

      const mx = e.clientX - r.left, my = e.clientY - r.top;
      if (this.dragging) {
        const dx = e.clientX - this.last.x, dy = e.clientY - this.last.y;
        this.cam.x += dx; this.cam.y += dy;
        this.camGoal.x += dx; this.camGoal.y += dy;
        this.moved += Math.abs(dx) + Math.abs(dy);
        this.last = { x: e.clientX, y: e.clientY };
      } else {
        const h = this._hit(mx, my);
        if (h !== this.hoverId) { this.hoverId = h; c.style.cursor = h >= 0 ? 'pointer' : 'grab'; }
      }
    });

    const up = (e: PointerEvent) => {
      this._ptrs.delete(e.pointerId);
      if (this._ptrs.size === 0) {
        if (this.dragging && this.moved < 8) {
          const r = c.getBoundingClientRect();
          const h = this._hit(e.clientX - r.left, e.clientY - r.top);
          if (h >= 0) this.select(h); else this.clearSel();
        }
        this.dragging = false;
        this._pinch.dist = 0;
        c.style.cursor = 'grab';
      } else if (this._ptrs.size === 1) {
        // Lift second finger → back to pan
        const ptr = Array.from(this._ptrs.values())[0];
        this.last = { x: ptr.x, y: ptr.y };
        this.dragging = true; this.moved = 8;
        this._pinch.dist = 0;
      }
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', (e) => {
      this._ptrs.delete(e.pointerId);
      if (this._ptrs.size === 0) { this.dragging = false; this._pinch.dist = 0; }
    });

    c.addEventListener('wheel', e => {
      e.preventDefault();
      const r = c.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const f  = Math.exp(-e.deltaY * 0.0014);
      const ns = Math.max(0.08, Math.min(3.2, this.cam.s * f));
      const wx = (mx - this.cam.x) / this.cam.s, wy = (my - this.cam.y) / this.cam.s;
      this.cam.s = ns; this.cam.x = mx - wx * ns; this.cam.y = my - wy * ns;
      this.camGoal = { ...this.cam };
    }, { passive: false });

    this._resizeHandler = () => this._resize();
    window.addEventListener('resize', this._resizeHandler);
  }

  private _resize(): void {
    if (!this.canvas) return;
    const r = this.canvas.getBoundingClientRect();
    this.cssW = r.width || window.innerWidth;
    this.cssH = r.height || window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = this.cssW * this.dpr;
    this.canvas.height = this.cssH * this.dpr;
  }

  private _hit(sx: number, sy: number): number {
    let best = -1, bd = 1e9;
    for (const n of this.nodes) {
      if (!n.visible) continue;
      const [px, py] = this.worldToScreen(n.x, n.y);
      const rr = this._rad(n) * this.cam.s + 6;
      const d = (px - sx) ** 2 + (py - sy) ** 2;
      if (d < rr * rr && d < bd) { bd = d; best = n.id; }
    }
    return best;
  }
}
