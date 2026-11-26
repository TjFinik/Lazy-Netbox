// ==UserScript==
// @name         NetBox: UI: Homepage (modern)
// @namespace    https://demo.netbox.dev/ui
// @version      2.1.0
// @description  New look at Netbox UI
// @author       TjFinik + vibe_mode
// @match        https://demo.netbox.dev/*
// @run-at       document-start
// @grant        none
// @noframes
// ==/UserScript==

(function () {
'use strict';

/* ============================================================
 * 0. КОНФИГУРАЦИЯ
 * ==========================================================*/
const CFG = {
  keys: { mode: 'nbx.ui.mode', sidebar: 'nbx.ui.sidebar', api: 'nbx.ui.api' },
  headerHeight: 54,
  sidebar: 'hide',                 // 'hide' | 'keep'
  hideNativeBreadcrumbs: true,     // скрывать ТОЛЬКО навигационную крошку шапки страницы
  prefillContext: true,
  maxMenuRows: 12,
  maxCrumbs: 4,
  api: {
    enabled: true,
    debounce: 240,
    minChars: 2,
    perSection: 5,
    perSelectedSection: 8,
    maxObjectRows: 10,
    brief: true,
    ttl: 60000,
    globalSections: [
      '/dcim/devices/', '/virtualization/virtual-machines/', '/ipam/ip-addresses/',
      '/ipam/prefixes/', '/dcim/sites/', '/dcim/racks/',
    ],
  },
};

const NO_QUERY = [
  /\/dcim\/rack-elevations\/?$/, /\/core\/system\/?$/, /\/core\/plugins\/?$/,
  /\/plugins\/server-room\/maps\/?$/, /\/plugins\/server-rooms\//,
  /\/plugins\/netbox_healthcheck_plugin\//, /\/plugins\/netbox_cluster_inventorization\//,
  /\/plugins\/inventory-storage\/config-context\/?$/,
];
const NO_API = [
  /\/dcim\/(interface|console|power)-connections\/?$/, /\/dcim\/rack-elevations\/?$/,
  /\/core\/(system|plugins|background-queues)\/?$/, /\/extras\/(scripts|table-configs)\/?$/,
  /\/plugins\/server-room\//, /\/plugins\/server-rooms\//, /\/plugins\/netbox_healthcheck_plugin\//,
  /\/plugins\/netbox_cluster_inventorization\//, /\/plugins\/inventory-storage\//,
];
const API_OVERRIDES = {
  '/core/changelog/': '/api/core/object-changes/',
  '/core/config-revisions/': '/api/core/config-revisions/',
};

const GROUP_ALIASES = {
  'organization': ['org', 'орг', 'организация'], 'racks': ['rack', 'стойки', 'рэки'],
  'devices': ['dev', 'device', 'устройства', 'железо'], 'connections': ['conn', 'соединения', 'кабели'],
  'wireless': ['wifi', 'wlan', 'беспровод'], 'ipam': ['ip', 'ипам', 'адресация'],
  'vpn': ['впн', 'туннели'], 'virtualization': ['vm', 'virt', 'виртуализация', 'вм'],
  'circuits': ['circuit', 'каналы', 'линки'], 'power': ['питание', 'электрика'],
  'provisioning': ['prov', 'конфиги', 'config'], 'customization': ['custom', 'скрипты'],
  'operations': ['ops', 'операции', 'интеграции'], 'admin': ['админ', 'админка', 'пользователи'],
  'plugins': ['plugin', 'плагины'],
};
const ITEM_ALIASES = {
  'sites': ['site', 'сайт', 'сайты', 'площадка', 'площадки'], 'site groups': ['sitegroup', 'группы сайтов'],
  'regions': ['region', 'регион', 'регионы'], 'locations': ['location', 'локация', 'помещение'],
  'tenants': ['tenant', 'тенант', 'арендатор', 'клиент'], 'contacts': ['contact', 'контакт'],
  'racks': ['rack', 'стойка', 'стойки', 'рэк'], 'devices': ['dev', 'device', 'устройство', 'устройства'],
  'device types': ['devicetype', 'тип устройства', 'модель'],
  'interfaces': ['int', 'interface', 'интерфейс', 'порт', 'порты'],
  'modules': ['module', 'модуль'], 'cables': ['cable', 'кабель', 'кабели'],
  'mac addresses': ['mac', 'мак', 'маки'], 'ip addresses': ['ip', 'ips', 'address', 'ип', 'адрес', 'адреса'],
  'ip ranges': ['range', 'диапазон'], 'prefixes': ['prefix', 'префикс', 'подсеть', 'подсети'],
  'vlans': ['vlan', 'влан', 'вланы'], 'vrfs': ['vrf', 'врф'], 'asns': ['asn', 'асн'],
  'aggregates': ['aggregate', 'агрегат'], 'virtual machines': ['vm', 'vms', 'вм', 'виртуалка', 'виртуалки'],
  'clusters': ['cluster', 'кластер'], 'circuits': ['circuit', 'канал', 'линк'],
  'providers': ['provider', 'провайдер', 'оператор'], 'power feeds': ['feed', 'фид', 'ввод'],
  'power panels': ['panel', 'щит'], 'users': ['user', 'пользователь'], 'tags': ['tag', 'тег', 'метки'],
};
const TYPE_BADGE = [
  [/\/dcim\/devices\/$/, 'DEV', 'blue'], [/\/virtualization\/virtual-machines\/$/, 'VM', 'violet'],
  [/\/ipam\/ip-addresses\/$/, 'IP', 'teal'], [/\/ipam\/prefixes\/$/, 'NET', 'cyan'],
  [/\/dcim\/sites\/$/, 'SITE', 'amber'], [/\/dcim\/racks\/$/, 'RACK', 'magenta'],
  [/\/dcim\/interfaces\/$/, 'IF', 'blue'], [/\/tenancy\/tenants\/$/, 'TNT', 'green'],
  [/\/circuits\/circuits\/$/, 'CKT', 'amber'], [/\/dcim\/cables\/$/, 'CBL', 'magenta'],
];

/* ============================================================
 * 1. УТИЛИТЫ
 * ==========================================================*/
const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[\s_\-.\/]+/g, ' ').trim();
const normPath = (p) => (p || '').replace(/\/?$/, '/');
const qUrl = (b, q) => b + (b.includes('?') ? '&' : '?') + 'q=' + encodeURIComponent(q);
const go = (url) => window.location.assign(url);
const isHome = () => ['/', '/home', '/home/'].includes(location.pathname);

const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
};
function getMode() {
  let m = LS.get(CFG.keys.mode, null);
  if (!m) m = LS.get('nbx.s1.mode', 'search') === 'classic' ? 'classic' : 'modern';
  return m === 'classic' ? 'classic' : 'modern';
}
const setMode = (m) => LS.set(CFG.keys.mode, m);
const sidebarMode = () => LS.get(CFG.keys.sidebar, CFG.sidebar);
const apiEnabled = () => LS.get(CFG.keys.api, CFG.api.enabled ? '1' : '0') === '1';

function h(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  kids.flat().forEach((k) => {
    if (k === null || k === undefined || k === false) return;
    n.append(k.nodeType ? k : document.createTextNode(String(k)));
  });
  return n;
}
function mark(text, q) {
  const f = document.createDocumentFragment();
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) { f.append(text); return f; }
  f.append(text.slice(0, i), h('mark', { text: text.slice(i, i + q.length) }), text.slice(i + q.length));
  return f;
}
const badgeFor = (href) => (TYPE_BADGE.find(([re]) => re.test(href)) || [null, null, 'slate']).slice(1);

/* ============================================================
 * 2. МОДЕЛЬ МЕНЮ
 * ==========================================================*/
let MENU = [];

function apiFor(href) {
  if (NO_API.some((re) => re.test(href))) return null;
  if (API_OVERRIDES[href]) return API_OVERRIDES[href];
  const core = href.match(/^\/(dcim|ipam|circuits|tenancy|virtualization|vpn|wireless|extras|users|core)\/([^/]+)\/?$/);
  if (core) return `/api/${core[1]}/${core[2]}/`;
  const plug = href.match(/^\/plugins\/([^/]+)\/([^/]+)\/?$/);
  if (plug) return `/api/plugins/${plug[1]}/${plug[2]}/`;
  return null;
}

function readMenu() {
  const root = document.querySelector('#sidebar-menu');
  if (!root) return [];
  const groups = [];
  root.querySelectorAll(':scope > ul.navbar-nav > li.nav-item.dropdown').forEach((li) => {
    const name = (li.querySelector('.nav-link-title')?.textContent || li.dataset.title || '').replace(/\s+/g, ' ').trim();
    if (!name) return;
    const icon = li.querySelector('.nav-link-icon i')?.className || 'mdi mdi-menu';
    const items = []; const seen = new Set();
    li.querySelectorAll('.dropdown-menu-column').forEach((col) => {
      let category = '';
      Array.from(col.children).forEach((node) => {
        if (node.classList.contains('text-uppercase')) { category = node.textContent.replace(/\s+/g, ' ').trim(); return; }
        const a = node.querySelector('a[href]:not(.btn)');
        if (!a) return;
        const label = a.textContent.replace(/\s+/g, ' ').trim();
        const href = a.getAttribute('href');
        if (!label || !href || href.startsWith('#') || seen.has(href)) return;
        seen.add(href);
        items.push({
          name: label, href, category,
          addUrl: node.querySelector('a.btn[href$="/add/"]')?.getAttribute('href') || null,
          importUrl: node.querySelector('a.btn[href*="import"]')?.getAttribute('href') || null,
          searchable: !NO_QUERY.some((re) => re.test(href)),
          api: apiFor(href),
        });
      });
    });
    if (items.length) groups.push({ name, icon, items });
  });
  return groups;
}

function findMenuByPath(path) {
  const p = normPath(path); let best = null;
  MENU.forEach((g) => g.items.forEach((it) => {
    const base = normPath(it.href);
    if ((p === base || p.startsWith(base)) && (!best || base.length > best.base.length)) best = { group: g, item: it, base };
  }));
  return best;
}
const findByHref = (href) => {
  for (const g of MENU) for (const it of g.items) if (normPath(it.href) === normPath(href)) return { group: g, item: it };
  return null;
};

function subseq(q, s) { let i = 0; for (const c of s) { if (c === q[i]) i++; if (i === q.length) return true; } return !q.length; }
function score(name, q, aliases) {
  const qq = norm(q); if (!qq) return 1;
  const n = norm(name), al = (aliases || []).map(norm);
  if (n === qq) return 100;
  if (al.includes(qq)) return 95;
  if (n.startsWith(qq)) return 85;
  if (al.some((a) => a.startsWith(qq))) return 75;
  if (n.split(' ').some((w) => w.startsWith(qq))) return 65;
  if (n.split(' ').map((w) => w[0]).join('').startsWith(qq)) return 55;
  if (n.includes(qq)) return 45;
  return subseq(qq, n) ? 20 : 0;
}
const byScore = (a, b) => b.s - a.s || a.label.length - b.label.length || a.label.localeCompare(b.label);

function findGroup(tok) {
  const n = norm(tok); if (!n) return null;
  const ex = MENU.filter((g) => norm(g.name) === n || (GROUP_ALIASES[norm(g.name)] || []).map(norm).includes(n));
  if (ex.length) return ex[0];
  const pr = MENU.filter((g) => norm(g.name).startsWith(n));
  return pr.length === 1 ? pr[0] : null;
}
function findItem(g, tok) {
  const n = norm(tok); if (!n) return null;
  const slug = (it) => norm(it.href.replace(/\/$/, '').split('/').pop());
  const ex = g.items.filter((it) => norm(it.name) === n || slug(it) === n || (ITEM_ALIASES[norm(it.name)] || []).map(norm).includes(n));
  if (ex.length) return ex[0];
  const pr = g.items.filter((it) => norm(it.name).startsWith(n));
  return pr.length === 1 ? pr[0] : null;
}

/* ============================================================
 * 3. ЖИВЫЕ ПОДСКАЗКИ ОБЪЕКТОВ
 * ==========================================================*/
const apiCache = new Map();
const apiDead = new Set();

const objLabel = (o) => o.display || o.name || o.address || o.prefix || o.label || o.username || ('#' + o.id);
function objSub(o, g, it) {
  const bits = []; const push = (v) => { if (v && bits.length < 3) bits.push(v); };
  push(o.site?.name || o.site?.display); push(o.rack?.name); push(o.device?.name);
  push(o.virtual_machine?.name); push(o.cluster?.name);
  push(o.status?.label || o.status?.value); push(o.role?.name); push(o.tenant?.name);
  push(o.assigned_object?.name); push(o.scope?.name); push(o.vrf?.name);
  if (!bits.length) push(o.description);
  return `${g.name} · ${it.name}` + (bits.length ? ' · ' + bits.join(' · ') : '');
}

async function apiSearch(it, g, q, limit, signal) {
  const base = it.api;
  if (!base || apiDead.has(base)) return [];
  const key = `${base}|${q}|${limit}|${CFG.api.brief}`;
  const hit = apiCache.get(key);
  if (hit && Date.now() - hit.t < CFG.api.ttl) return hit.rows;
  const url = `${base}?q=${encodeURIComponent(q)}&limit=${limit}` + (CFG.api.brief ? '&brief=true' : '');
  let res;
  try { res = await fetch(url, { signal, credentials: 'same-origin', headers: { Accept: 'application/json' } }); }
  catch (e) { return []; }
  if (!res.ok) { if ([403, 404, 405, 501].includes(res.status)) apiDead.add(base); return []; }
  let data; try { data = await res.json(); } catch (e) { return []; }
  const rows = (data.results || []).map((o) => ({
    kind: 'object', group: g, item: it, obj: o,
    title: objLabel(o), sub: objSub(o, g, it), url: normPath(it.href) + o.id + '/',
  }));
  apiCache.set(key, { t: Date.now(), rows });
  return rows;
}

/* ============================================================
 * 4. ОБЩИЙ КОМПОНЕНТ ПОИСКА
 * ==========================================================*/
function SearchField({ compact = false, value = '' } = {}) {
  const input = h('input', {
    type: 'text', name: 'q', class: 'nbx-input', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'off',
    placeholder: compact ? 'Поиск по NetBox…' : 'Серийник, IP, имя устройства…  или  org → Sites → площадка',
    role: 'combobox', 'aria-expanded': 'false', 'aria-autocomplete': 'list', 'aria-label': 'Поиск NetBox',
  });
  const kbdHint = compact ? null : h('span', { class: 'nbx-kbd-hint' }, h('kbd', {}, 'Ctrl'), h('kbd', {}, 'K'));
  const spin = h('span', { class: 'nbx-spin', 'aria-hidden': 'true' }, h('i', { class: 'mdi mdi-loading' }));
  const clear = h('button', { type: 'button', class: 'nbx-clear', title: 'Очистить (Esc)', 'aria-label': 'Очистить' }, h('i', { class: 'mdi mdi-close' }));
  const form = h('form', { class: 'nbx-field', action: '/search/', method: 'get' },
    h('span', { class: 'nbx-lead' }, h('i', { class: 'mdi mdi-magnify' })), input, kbdHint, spin, clear);
  const rowsEl = h('div', { class: 'nbx-rows', role: 'listbox' });
  const chips = h('div', { class: 'nbx-chips' });
  const target = h('div', { class: 'nbx-target' });
  const list = h('div', { class: 'nbx-list' }, rowsEl, h('div', { class: 'nbx-foot' }, chips, target));
  const root = h('div', { class: 'nbx-search' + (compact ? ' compact' : ' hero') }, form, list);

  let rows = [], active = -1, open = false, token = 0, timer = null, ctrl = null;

  const state = () => {
    const raw = input.value, parts = raw.split(':');
    const tail = parts[parts.length - 1].trim();
    const tokens = parts.slice(0, -1).map((t) => t.trim());
    const group = tokens.length ? findGroup(tokens[0]) : null;
    const item = group && tokens.length > 1 ? findItem(group, tokens[1]) : null;
    return { raw, tail, tokens, group, item };
  };

  function menuRows() {
    const st = state(), out = [], limit = st.tail ? CFG.maxMenuRows : 60;
    if (st.tokens.length >= 2 && st.group && st.item) {
      out.push({ kind: st.tail && st.item.searchable ? 'section-search' : 'section-open', group: st.group, item: st.item, query: st.tail });
      return out;
    }
    if (st.tokens.length === 1 && st.group) {
      st.group.items.map((it) => ({ it, s: score(it.name, st.tail, ITEM_ALIASES[norm(it.name)]), label: it.name }))
        .filter((x) => x.s > 0).sort(byScore).slice(0, limit)
        .forEach((x) => out.push({ kind: 'item', group: st.group, item: x.it }));
      if (st.tail && !out.length) out.push({ kind: 'global', query: st.raw.trim() });
      return out;
    }
    if (st.tokens.length === 0) {
      if (st.tail) out.push({ kind: 'global', query: st.tail });
      const merged = MENU.map((g) => ({ kind: 'group', group: g, s: score(g.name, st.tail, GROUP_ALIASES[norm(g.name)]), label: g.name })).filter((x) => x.s > 0);
      if (st.tail) MENU.forEach((g) => g.items.forEach((it) => {
        const s = score(it.name, st.tail, ITEM_ALIASES[norm(it.name)]);
        if (s > 0) merged.push({ kind: 'item', group: g, item: it, s: s - 5, label: it.name });
      }));
      merged.sort(byScore);
      return out.concat(merged.slice(0, limit));
    }
    if (st.raw.trim()) out.push({ kind: 'global', query: st.raw.trim() });
    return out;
  }

  function view(r, q) {
    switch (r.kind) {
      case 'global': return { icon: 'mdi mdi-magnify', title: `Искать «${r.query}» во всём NetBox`, sub: qUrl('/search/', r.query), kbd: 'Enter', hl: '' };
      case 'group': return { icon: r.group.icon, title: r.group.name + ':', sub: `${r.group.items.length} разделов · Tab — дополнить`, kbd: 'Tab', hl: q };
      case 'item': return { icon: 'mdi mdi-chevron-right', title: r.item.name, sub: `${r.group.name}${r.item.category ? ' · ' + r.item.category : ''} · ${r.item.href}`, kbd: 'Tab', hl: q };
      case 'section-search': return { icon: 'mdi mdi-magnify', title: `Искать «${r.query}» в ${r.item.name}`, sub: qUrl(r.item.href, r.query), kbd: 'Enter', hl: '' };
      case 'section-open': return { icon: 'mdi mdi-arrow-right', title: `Открыть ${r.item.name}`, sub: r.item.href, kbd: 'Enter', hl: '' };
      default: return { icon: 'mdi mdi-cube-outline', title: r.title, sub: r.sub, kbd: 'карточка', hl: q };
    }
  }

  const sep = (t) => h('div', { class: 'nbx-sep' }, t);

  function render() {
    const q = state().tail;
    rowsEl.replaceChildren();
    const hasObj = rows.some((r) => r.kind === 'object');
    let objSep = false, menuSep = false;
    rows.forEach((r, i) => {
      if (r.kind === 'object' && !objSep) { objSep = true; rowsEl.append(sep('Объекты · REST API')); }
      if ((r.kind === 'group' || r.kind === 'item') && hasObj && !menuSep) { menuSep = true; rowsEl.append(sep('Разделы')); }
      const v = view(r, q);
      const [badge, hue] = r.kind === 'object' ? badgeFor(r.item.href) : [null, null];
      rowsEl.append(h('div', {
        class: 'nbx-row' + (i === active ? ' active' : '') + (r.kind === 'object' ? ' obj' : ''),
        role: 'option', 'data-i': String(i), 'aria-selected': String(i === active),
        onmouseenter: () => setActive(i, false), onmousedown: (e) => e.preventDefault(), onclick: () => accept(r),
      },
        h('i', { class: v.icon }),
        h('div', { class: 't' }, h('b', {}, mark(v.title, v.hl)), h('small', { text: v.sub })),
        badge ? h('span', { class: 'nbx-badge hue-' + hue }, badge) : null,
        h('kbd', { text: v.kbd })));
    });
    if (!rows.length) rowsEl.append(h('div', { class: 'nbx-empty' }, 'Начните вводить запрос или название раздела'));

    const st = state();
    chips.replaceChildren();
    if (st.group) chips.append(chip(st.group.name, () => { input.value = ''; afterEdit(); }));
    if (st.group && st.item) chips.append(chip(st.item.name, () => { input.value = st.group.name + ': '; afterEdit(); }));
    if (!st.group) chips.append(h('span', { class: 'nbx-chip ghost' }, 'Весь NetBox'));
    target.textContent = '→ ' + (st.group && st.item
      ? (st.item.searchable ? qUrl(st.item.href, st.tail || '…') : st.item.href)
      : qUrl('/search/', st.raw.trim() || '…'));
    clear.style.display = input.value ? '' : 'none';
    if (kbdHint) kbdHint.style.display = input.value ? 'none' : '';
  }

  function chip(label, onRemove) {
    return h('span', { class: 'nbx-chip' }, label,
      h('button', { type: 'button', title: 'Убрать', onclick: (e) => { e.preventDefault(); onRemove(); } }, '×'));
  }
  function setActive(i, scroll = true) {
    active = i;
    rowsEl.querySelectorAll('.nbx-row').forEach((el) => {
      const on = Number(el.dataset.i) === i;
      el.classList.toggle('active', on);
      el.setAttribute('aria-selected', String(on));
      if (on && scroll) el.scrollIntoView({ block: 'nearest' });
    });
  }
  function setOpen(v) { open = v; list.classList.toggle('open', v); input.setAttribute('aria-expanded', String(v)); }
  const setSpin = (v) => root.classList.toggle('loading', v);

  function refresh(keepOpen = true) {
    const my = ++token;
    rows = menuRows(); active = -1; render(); setOpen(keepOpen && rows.length > 0);
    clearTimeout(timer); if (ctrl) ctrl.abort(); setSpin(false);
    const st = state();
    if (!apiEnabled() || st.tail.length < CFG.api.minChars) return;
    if (st.tokens.length && !(st.group && st.item)) return;
    timer = setTimeout(() => runApi(my, st.tail), CFG.api.debounce);
  }

  async function runApi(my, q) {
    const st = state();
    const selected = st.group && st.item;
    const targets = selected ? [{ group: st.group, item: st.item }] : CFG.api.globalSections.map(findByHref).filter(Boolean);
    if (!targets.length) return;
    ctrl = new AbortController(); setSpin(true);
    const limit = selected ? CFG.api.perSelectedSection : CFG.api.perSection;
    const res = await Promise.all(targets.map((t) => apiSearch(t.item, t.group, q, limit, ctrl.signal).catch(() => [])));
    if (my !== token) return;
    setSpin(false);
    const objs = res.flat().slice(0, selected ? limit : CFG.api.maxObjectRows);
    if (!objs.length) return;
    rows = menuRows().concat(objs); render(); setOpen(true);
  }

  function afterEdit() { refresh(true); input.focus(); const n = input.value.length; input.setSelectionRange(n, n); }

  function accept(r) {
    if (!r) return;
    if (r.kind === 'group') { input.value = r.group.name + ': '; return afterEdit(); }
    if (r.kind === 'item') { input.value = r.group.name + ': ' + r.item.name + ': '; return afterEdit(); }
    if (r.kind === 'global') return go(qUrl('/search/', r.query));
    if (r.kind === 'section-search') return go(qUrl(r.item.href, r.query));
    if (r.kind === 'object') return go(r.url);
    return go(r.item.href);
  }
  function defaultAction() {
    const st = state();
    if (st.group && st.item && st.tokens.length >= 2) {
      if (st.tail && st.item.searchable) return go(qUrl(st.item.href, st.tail));
      return go(st.item.href);
    }
    if (st.raw.trim()) go(qUrl('/search/', st.raw.trim()));
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); defaultAction(); });
  input.addEventListener('input', () => refresh(true));
  input.addEventListener('focus', () => refresh(true));
  clear.addEventListener('click', () => { input.value = ''; refresh(true); input.focus(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!rows.length) return;
      e.preventDefault(); if (!open) refresh(true);
      const d = e.key === 'ArrowDown' ? 1 : -1;
      setActive(active < 0 ? (d > 0 ? 0 : rows.length - 1) : (active + d + rows.length) % rows.length);
    } else if (e.key === 'Tab' && !e.shiftKey) {
      if (!open || !rows.length) refresh(true);
      let i = active >= 0 ? active : -1;
      if (i < 0 || !['group', 'item'].includes(rows[i]?.kind)) i = rows.findIndex((r) => r.kind === 'group' || r.kind === 'item');
      if (i >= 0) { e.preventDefault(); e.stopPropagation(); accept(rows[i]); }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.altKey) { const o = rows.find((r) => r.kind === 'object'); if (o) return accept(o); }
      if (open && active >= 0) accept(rows[active]); else defaultAction();
    } else if (e.key === 'Escape') {
      if (open) { e.preventDefault(); e.stopPropagation(); setOpen(false); }
      else if (input.value) { e.preventDefault(); e.stopPropagation(); input.value = ''; refresh(true); }
    } else if (e.key === 'Backspace') {
      const v = input.value, p = input.selectionStart;
      if (p === v.length && input.selectionEnd === p && /:\s$/.test(v)) {
        e.preventDefault(); const parts = v.split(':'); parts.splice(parts.length - 2, 1);
        input.value = parts.join(':').replace(/^\s+/, ''); refresh(true);
      }
    }
  });
  document.addEventListener('mousedown', (e) => { if (!root.contains(e.target)) setOpen(false); });

  input.value = value;
  render();
  return { root, input, focus: () => { input.focus(); input.select(); }, refresh };
}

/* ============================================================
 * 5. ХЕДЕР / КРОШКИ / МЕГА-МЕНЮ
 * ==========================================================*/
let headerField = null, heroField = null, menuPanel = null, menuInput = null, crumbsExpanded = false;
const moved = [];

function relocate(node, parent) { moved.push({ node, parent: node.parentNode, next: node.nextSibling }); parent.append(node); }
function restoreMoved() {
  moved.splice(0).reverse().forEach(({ node, parent, next }) => {
    if (parent) parent.insertBefore(node, next && next.parentNode === parent ? next : null);
  });
}

/* Единственная навигационная крошка шапки (generic/object.html).
   Крошки-цепочки внутри таблиц атрибутов (Region / Site / Location / Tenant / Role) НЕ трогаем. */
function headerBreadcrumb() {
  const header = document.querySelector('#page-content .page-header');
  if (!header) return null;
  return Array.from(header.querySelectorAll('ol.breadcrumb'))
    .find((o) => !o.closest('table, thead, tbody, tr, td, th, .card, .panel, .tab-content, .attr-table')) || null;
}
function healFieldBreadcrumbs() {
  // возврат значений полей, скрытых предыдущей версией скрипта
  document.querySelectorAll('#page-content table ol.breadcrumb, #page-content .card ol.breadcrumb, #page-content td ol.breadcrumb')
    .forEach((el) => {
      el.classList.remove('nbx-crumb-hidden');
      if (el.style.display === 'none') el.style.removeProperty('display');
    });
}
function syncBreadcrumbVisibility(headerOl) {
  document.querySelectorAll('.nbx-crumb-hidden').forEach((el) => { if (el !== headerOl) el.classList.remove('nbx-crumb-hidden'); });
  healFieldBreadcrumbs();
  if (CFG.hideNativeBreadcrumbs && headerOl) headerOl.classList.add('nbx-crumb-hidden');
}

function prefill() {
  if (!CFG.prefillContext) return '';
  const q = new URLSearchParams(location.search).get('q') || '';
  if (location.pathname === '/search/') return q;
  const m = findMenuByPath(location.pathname);
  if (m && normPath(location.pathname) === normPath(m.item.href)) return `${m.group.name}: ${m.item.name}: ${q}` + (q ? '' : ' ');
  return '';
}

function crumbsData() {
  const path = location.pathname, out = [];
  const title = (document.querySelector('#page-content h1.page-title')?.textContent || '').replace(/\s+/g, ' ').trim();
  if (path === '/search/') {
    out.push({ label: 'Поиск', href: '/search/' });
    const q = new URLSearchParams(location.search).get('q');
    if (q) out.push({ label: q, current: true });
    return out;
  }
  const m = findMenuByPath(path);
  const listCrumb = m ? { label: m.item.name, href: m.item.href } : null;
  const ol = headerBreadcrumb();
  const nat = ol ? Array.from(ol.querySelectorAll('li.breadcrumb-item')).map((li) => {
    const a = li.querySelector('a[href]');
    return { label: li.textContent.replace(/\s+/g, ' ').trim(), href: a ? a.getAttribute('href') : null };
  }).filter((x) => x.label) : [];

  if (m) out.push({ label: m.group.name, menuGroup: m.group.name });
  if (nat.length) {
    nat.forEach((it) => out.push({ label: it.label, href: it.href }));
    if (listCrumb && !out.some((o) => o.href && normPath(o.href) === normPath(listCrumb.href))) out.splice(m ? 1 : 0, 0, listCrumb);
  } else if (listCrumb) out.push(listCrumb);

  const onList = m && normPath(path) === normPath(m.item.href);
  const last = out[out.length - 1];
  if (!onList && title && (!last || norm(last.label) !== norm(title))) out.push({ label: title, current: true });
  if (!out.length) out.push({ label: document.title.replace(/\s*\|\s*NetBox\s*$/, '') || 'NetBox', current: true });
  out.forEach((c, i) => { if (i === out.length - 1 && !c.href) c.current = true; });
  return out;
}

function renderCrumbs(box) {
  const data = crumbsData();
  box.replaceChildren();
  const push = (c, i) => {
    if (i) box.append(h('span', { class: 'nbx-crumb-sep' }, '›'));
    const cls = 'nbx-crumb' + (c.current ? ' current' : '');
    if (c.menuGroup) box.append(h('button', { type: 'button', class: cls, title: 'Разделы группы ' + c.label, onclick: () => openMenu(c.menuGroup) }, c.label));
    else if (c.href && !c.current) box.append(h('a', { class: cls, href: c.href, title: c.label }, c.label));
    else box.append(h('span', { class: cls, title: c.label }, c.label));
  };
  if (data.length > CFG.maxCrumbs && !crumbsExpanded) {
    push(data[0], 0);
    const hidden = data.slice(1, -2);
    box.append(h('span', { class: 'nbx-crumb-sep' }, '›'));
    box.append(h('button', { type: 'button', class: 'nbx-crumb more', title: hidden.map((c) => c.label).join(' › '), onclick: () => { crumbsExpanded = true; renderCrumbs(box); } }, '…'));
    data.slice(-2).forEach((c, i) => push(c, i + 1));
  } else {
    data.forEach(push);
  }
  const code = document.querySelector('#page-content .page-header code')?.textContent.replace(/\s+/g, ' ').trim();
  if (code) box.append(h('span', { class: 'nbx-objid', title: code }, code));
  syncBreadcrumbVisibility(headerBreadcrumb());
}

function buildHeader() {
  if (document.getElementById('nbx-header')) return;
  const crumbs = h('nav', { class: 'nbx-crumbs', 'aria-label': 'breadcrumb' });
  const searchWrap = h('div', { class: 'nbx-hdr-search' });
  const right = h('div', { class: 'nbx-hdr-right' });
  const hdr = h('div', { id: 'nbx-header' },
    h('button', { class: 'nbx-ibtn', type: 'button', title: 'Меню разделов (Alt+M)', 'aria-label': 'Меню', onclick: () => toggleMenu() }, h('i', { class: 'mdi mdi-menu' })),
    h('a', { class: 'nbx-logo', href: '/', title: 'На главную' },
      h('img', { src: '/static/logo_netbox_dark_teal.svg', alt: 'NetBox', class: 'hide-theme-dark' }),
      h('img', { src: '/static/logo_netbox_bright_teal.svg', alt: 'NetBox', class: 'hide-theme-light' })),
    crumbs, searchWrap, right);
  document.body.append(hdr);

  headerField = SearchField({ compact: true, value: prefill() });
  searchWrap.append(headerField.root);

  const nativeRight = document.querySelector('header.navbar .navbar-nav.order-md-last');
  if (nativeRight) relocate(nativeRight, right);
  right.append(h('button', { class: 'nbx-ibtn', type: 'button', title: 'Классический интерфейс (Alt+Z)', onclick: toggleMode }, h('i', { class: 'mdi mdi-undo-variant' })));
  crumbsExpanded = false;
  renderCrumbs(crumbs);
}

function buildMenu() {
  if (menuPanel) return;
  menuInput = h('input', { type: 'text', class: 'nbx-menu-filter', placeholder: 'Фильтр разделов…', autocomplete: 'off', 'aria-label': 'Фильтр разделов' });
  const grid = h('div', { class: 'nbx-menu-grid' });
  const counter = h('span', { class: 'nbx-menu-hint' });
  menuPanel = h('div', { id: 'nbx-menu' }, h('div', { class: 'nbx-menu-head' }, menuInput, counter), grid);
  document.body.append(menuPanel);

  const draw = () => {
    const f = menuInput.value.trim();
    grid.replaceChildren();
    let shown = 0;
    MENU.forEach((g) => {
      const gs = score(g.name, f, GROUP_ALIASES[norm(g.name)]);
      const items = g.items.filter((it) => !f || gs > 0 || score(it.name, f, ITEM_ALIASES[norm(it.name)]) > 0);
      if (!items.length) return;
      shown += items.length;
      const col = h('div', { class: 'nbx-menu-col' }, h('div', { class: 'nbx-menu-title' }, h('i', { class: g.icon }), g.name));
      items.forEach((it) => col.append(h('div', { class: 'nbx-menu-row' },
        h('a', { class: 'nbx-menu-link', href: it.href }, mark(it.name, f)),
        it.addUrl ? h('a', { class: 'nbx-mini', href: it.addUrl, title: 'Добавить' }, h('i', { class: 'mdi mdi-plus-thick' })) : null,
        it.importUrl ? h('a', { class: 'nbx-mini', href: it.importUrl, title: 'Импорт' }, h('i', { class: 'mdi mdi-upload' })) : null)));
      grid.append(col);
    });
    if (!shown) grid.append(h('div', { class: 'nbx-menu-empty' }, 'Ничего не найдено'));
    counter.textContent = `${shown} разделов · Esc — закрыть`;
  };
  menuInput.addEventListener('input', draw);
  menuInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(); }
    if (e.key === 'Enter') { const a = grid.querySelector('.nbx-menu-link'); if (a) go(a.getAttribute('href')); }
  });
  menuPanel._draw = draw;
  document.addEventListener('mousedown', (e) => {
    if (menuPanel.classList.contains('open') && !menuPanel.contains(e.target) && !e.target.closest('#nbx-header .nbx-ibtn')) closeMenu();
  });
}
function openMenu(filter = '') { buildMenu(); menuInput.value = filter; menuPanel._draw(); menuPanel.classList.add('open'); setTimeout(() => menuInput.focus(), 0); }
function closeMenu() { if (menuPanel) menuPanel.classList.remove('open'); }
function toggleMenu() { menuPanel && menuPanel.classList.contains('open') ? closeMenu() : openMenu(); }

/* ============================================================
 * 6. ГЛАВНАЯ
 * ==========================================================*/
function buildHero() {
  if (document.getElementById('nbx-hero')) return;
  heroField = SearchField({ compact: false });
  const sections = MENU.reduce((n, g) => n + g.items.length, 0);
  const live = CFG.api.globalSections.map(findByHref).filter(Boolean).length;
  const hero = h('div', { id: 'nbx-hero' },
    h('div', { class: 'nbx-aurora', 'aria-hidden': 'true' }),
    h('div', { class: 'nbx-hero-inner' },
      h('div', { class: 'nbx-hero-logo' },
        h('img', { src: '/static/logo_netbox_dark_teal.svg', alt: 'NetBox', class: 'hide-theme-dark' }),
        h('img', { src: '/static/logo_netbox_bright_teal.svg', alt: 'NetBox', class: 'hide-theme-light' })),
      heroField.root,
      h('div', { class: 'nbx-hero-stats' },
        h('span', {}, h('i', { class: 'mdi mdi-sitemap' }), `${MENU.length} групп · ${sections} разделов`),
        h('span', { class: 'dot' }, '•'),
        h('span', {}, h('i', { class: 'mdi mdi-flash' }), `живой поиск по ${live} моделям`)),
      h('div', { class: 'nbx-help' },
        h('kbd', {}, 'Enter'), ' искать · ', h('kbd', {}, 'Tab'), ' дополнить раздел · ',
        h('kbd', {}, '↑↓'), ' выбор · ', h('kbd', {}, 'Alt+Enter'), ' первый объект · ', h('kbd', {}, 'Alt+Z'), ' обычный интерфейс')));
  (document.querySelector('.page-wrapper') || document.body).prepend(hero);
}

function ensurePill() {
  let p = document.getElementById('nbx-pill');
  if (!p) { p = h('button', { id: 'nbx-pill', type: 'button', title: 'Alt+Z', onclick: toggleMode }); document.body.append(p); }
  p.replaceChildren(h('i', { class: 'mdi mdi-magnify' }), 'Поиск-режим');
}

/* ============================================================
 * 7. ЖИЗНЕННЫЙ ЦИКЛ
 * ==========================================================*/
function toggleMode() { setMode(getMode() === 'modern' ? 'classic' : 'modern'); apply(); }

function apply() {
  try {
    const modern = getMode() === 'modern' && !!document.querySelector('#sidebar-menu');
    const home = isHome();
    const root = document.documentElement;
    root.classList.toggle('nbx-ui-on', modern && !home);
    root.classList.toggle('nbx-home', modern && home);
    root.classList.toggle('nbx-sidebar-keep', modern && !home && sidebarMode() === 'keep');
    root.style.setProperty('--nbx-h', CFG.headerHeight + 'px');

    if (!modern) { restoreMoved(); closeMenu(); healFieldBreadcrumbs(); ensurePill(); return; }

    if (!MENU.length) MENU = readMenu();

    if (home) { buildHero(); ensurePill(); requestAnimationFrame(() => heroField && heroField.focus()); }
    else { buildHeader(); ensurePill(); }

    if (!MENU.length) setTimeout(() => {
      MENU = readMenu();
      if (MENU.length) { headerField && headerField.refresh(false); heroField && heroField.refresh(false); }
    }, 300);
  } catch (err) {
    console.error('[NetBox UI] fallback to native UI:', err);
    document.documentElement.classList.remove('nbx-ui-on', 'nbx-home', 'nbx-sidebar-keep');
    try { restoreMoved(); healFieldBreadcrumbs(); } catch (e) {}
  }
}

/* ---------- CSS ---------- */
const CSS = `
:root{
  --nbx-h:${CFG.headerHeight}px;
  --nbx-blue:#206bc4; --nbx-teal:#0ca678; --nbx-cyan:#0aa2c0; --nbx-violet:#7048e8;
  --nbx-amber:#f08c00; --nbx-magenta:#d6336c; --nbx-green:#2fb344; --nbx-red:#d63939; --nbx-slate:#64748b;
  --nbx-surface:var(--tblr-bg-surface,#fff);
  --nbx-bg:var(--tblr-body-bg,#f4f6fa);
  --nbx-ink:var(--tblr-body-color,#182433);
  --nbx-muted:var(--tblr-secondary-color,#6c7a91);
  --nbx-line:var(--tblr-border-color,#dce1e7);
  --nbx-hover:var(--tblr-active-bg,rgba(32,107,196,.10));
}
html.nbx-ui-on body{ padding-top:var(--nbx-h); }
html.nbx-ui-on .page{ min-height:calc(100vh - var(--nbx-h)); }
html.nbx-ui-on .page > header.navbar{ display:none !important; }
html.nbx-ui-on:not(.nbx-sidebar-keep) .page > aside.navbar-vertical{ display:none !important; }
html.nbx-ui-on:not(.nbx-sidebar-keep) .page-wrapper{ margin-left:0 !important; width:100% !important; }
html.nbx-ui-on.nbx-sidebar-keep .page > aside.navbar-vertical{ max-height:calc(100vh - var(--nbx-h)); overflow:auto; }
html.nbx-ui-on #page-content :target{ scroll-margin-top:calc(var(--nbx-h) + 14px); }
html.nbx-ui-on .nbx-crumb-hidden{ display:none !important; }
html.nbx-home .page > aside.navbar-vertical, html.nbx-home .page > header.navbar{ display:none !important; }
html.nbx-home .page-wrapper > *:not(#nbx-hero){ display:none !important; }
html.nbx-home .page-wrapper{ margin-left:0 !important; width:100% !important; }

#nbx-header{ position:fixed; inset:0 0 auto 0; height:var(--nbx-h); z-index:1035; display:flex; align-items:center;
  gap:10px; padding:0 12px; box-sizing:border-box; background:var(--nbx-surface);
  border-bottom:1px solid var(--nbx-line); box-shadow:0 1px 0 rgba(15,23,42,.02),0 6px 18px rgba(15,23,42,.05); }
#nbx-header::after{ content:''; position:absolute; left:0; right:0; bottom:-1px; height:2px;
  background:linear-gradient(90deg,var(--nbx-teal),var(--nbx-blue) 32%,var(--nbx-violet) 62%,var(--nbx-magenta) 88%,var(--nbx-amber));
  opacity:.55; }
#nbx-header .nbx-logo img{ height:26px; display:block; }
.nbx-ibtn{ border:0; background:transparent; cursor:pointer; border-radius:9px; padding:6px 8px; font-size:19px;
  line-height:1; color:var(--nbx-muted); transition:background .15s,color .15s,transform .15s; }
.nbx-ibtn:hover{ background:var(--nbx-hover); color:var(--nbx-blue); }
.nbx-ibtn:active{ transform:scale(.94); }
.nbx-crumbs{ display:flex; align-items:center; gap:5px; flex:1 1 auto; min-width:0; overflow:hidden; white-space:nowrap; }
.nbx-crumb{ font-size:13px; color:var(--nbx-muted); text-decoration:none; border:0; background:transparent;
  padding:3px 6px; border-radius:7px; cursor:pointer; overflow:hidden; text-overflow:ellipsis; max-width:26ch; }
a.nbx-crumb:hover, button.nbx-crumb:hover{ background:var(--nbx-hover); color:var(--nbx-blue); }
.nbx-crumb.current{ color:var(--nbx-ink); font-weight:650; cursor:default; }
.nbx-crumb.more{ font-weight:700; letter-spacing:.06em; }
.nbx-crumb-sep{ color:var(--nbx-muted); opacity:.45; }
.nbx-objid{ font-family:var(--tblr-font-monospace,monospace); font-size:11px; color:var(--nbx-muted);
  border:1px solid var(--nbx-line); border-radius:7px; padding:1px 7px; background:var(--nbx-bg); }
.nbx-hdr-search{ flex:0 1 470px; min-width:210px; }
.nbx-hdr-right{ display:flex; align-items:center; gap:4px; flex:0 0 auto; }
.nbx-hdr-right .navbar-nav{ gap:8px; align-items:center; }
.nbx-hdr-right .nav-link{ font-size:18px !important; padding:0 4px !important; }
.nbx-hdr-right .dropdown-menu{ z-index:1090; }

.nbx-search{ position:relative; }
.nbx-field{ position:relative; display:flex; align-items:center; }
.nbx-lead{ position:absolute; left:12px; font-size:16px; color:var(--nbx-muted); pointer-events:none; }
.nbx-input{ width:100%; box-sizing:border-box; border-radius:11px; outline:none; font-size:14px; line-height:1.4;
  border:1px solid var(--nbx-line); background:var(--nbx-bg); color:var(--nbx-ink); padding:8px 62px 8px 36px;
  transition:border-color .15s, box-shadow .15s, background .15s; }
.nbx-input::placeholder{ color:var(--nbx-muted); opacity:.8; }
.nbx-input:focus{ border-color:var(--nbx-blue); background:var(--nbx-surface); box-shadow:0 0 0 3px rgba(32,107,196,.16); }
.nbx-search.hero .nbx-input{ font-size:20px; padding:19px 104px 19px 54px; border-radius:18px;
  background:var(--nbx-surface); box-shadow:0 18px 44px rgba(8,20,40,.13); }
.nbx-search.hero .nbx-lead{ left:19px; font-size:23px; color:var(--nbx-teal); }
.nbx-kbd-hint{ position:absolute; right:46px; display:flex; gap:4px; pointer-events:none; }
.nbx-kbd-hint kbd{ font-size:10.5px; padding:2px 6px; border-radius:6px; border:1px solid var(--nbx-line);
  color:var(--nbx-muted); background:var(--nbx-bg); }
.nbx-clear,.nbx-spin{ position:absolute; right:13px; font-size:16px; color:var(--nbx-muted); }
.nbx-search.hero .nbx-clear,.nbx-search.hero .nbx-spin{ right:19px; }
.nbx-clear{ border:0; background:transparent; cursor:pointer; padding:5px; border-radius:7px; }
.nbx-clear:hover{ background:var(--nbx-hover); color:var(--nbx-red); }
.nbx-spin{ display:none; right:38px; }
.nbx-search.hero .nbx-spin{ right:48px; }
.nbx-search.loading .nbx-spin{ display:inline-flex; animation:nbxspin .9s linear infinite; color:var(--nbx-teal); }
.nbx-search.loading .nbx-kbd-hint{ display:none; }
@keyframes nbxspin{ to{ transform:rotate(360deg); } }

.nbx-list{ position:absolute; top:calc(100% + 7px); right:0; width:min(660px,94vw); z-index:1080; display:none;
  border-radius:15px; border:1px solid var(--nbx-line); background:var(--nbx-surface);
  box-shadow:0 26px 60px rgba(8,20,40,.22); overflow:hidden; }
.nbx-search.hero .nbx-list{ left:0; right:0; width:auto; }
.nbx-list.open{ display:block; animation:nbxpop .16s cubic-bezier(.2,.8,.3,1); }
@keyframes nbxpop{ from{ opacity:0; transform:translateY(-6px); } to{ opacity:1; transform:none; } }
.nbx-rows{ max-height:366px; overflow:auto; padding:6px; scrollbar-width:thin; scrollbar-color:var(--nbx-teal) transparent; }
.nbx-rows::-webkit-scrollbar{ width:10px; }
.nbx-rows::-webkit-scrollbar-track{ background:transparent; margin:6px 0; }
.nbx-rows::-webkit-scrollbar-thumb{ border-radius:99px; border:3px solid var(--nbx-surface);
  background:linear-gradient(180deg,var(--nbx-teal),var(--nbx-blue)); }
.nbx-rows::-webkit-scrollbar-thumb:hover{ background:linear-gradient(180deg,var(--nbx-blue),var(--nbx-violet)); }
.nbx-sep{ font-size:10.5px; text-transform:uppercase; letter-spacing:.07em; padding:8px 12px 3px; color:var(--nbx-muted); }
.nbx-empty{ padding:16px 12px; font-size:13px; color:var(--nbx-muted); }
.nbx-row{ display:flex; align-items:center; gap:11px; padding:8px 12px; border-radius:11px; cursor:pointer;
  border:1px solid transparent; }
.nbx-row.active{ background:var(--nbx-hover); border-color:rgba(32,107,196,.22); }
.nbx-row > i{ font-size:18px; width:22px; text-align:center; color:var(--nbx-blue); }
.nbx-row.obj > i{ color:var(--nbx-teal); }
.nbx-row .t{ flex:1 1 auto; min-width:0; }
.nbx-row .t b{ display:block; font-weight:620; font-size:14px; color:var(--nbx-ink);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.nbx-row .t small{ display:block; font-size:11.5px; color:var(--nbx-muted);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.nbx-row mark{ background:rgba(12,166,120,.22); color:inherit; border-radius:3px; padding:0 1px; }
.nbx-row kbd{ font-size:10px; padding:2px 6px; border-radius:6px; background:transparent; white-space:nowrap;
  border:1px solid var(--nbx-line); color:var(--nbx-muted); }
.nbx-badge{ font-size:9.5px; font-weight:800; letter-spacing:.06em; padding:2px 6px; border-radius:6px; color:#fff; }
.hue-blue{ background:var(--nbx-blue); } .hue-teal{ background:var(--nbx-teal); } .hue-cyan{ background:var(--nbx-cyan); }
.hue-violet{ background:var(--nbx-violet); } .hue-amber{ background:var(--nbx-amber); }
.hue-magenta{ background:var(--nbx-magenta); } .hue-green{ background:var(--nbx-green); } .hue-slate{ background:var(--nbx-slate); }
.nbx-foot{ display:flex; align-items:center; justify-content:space-between; gap:10px; padding:7px 12px;
  border-top:1px solid var(--nbx-line); font-size:12px; color:var(--nbx-muted); background:var(--nbx-bg); }
.nbx-chips{ display:flex; gap:6px; flex-wrap:wrap; }
.nbx-chip{ display:inline-flex; align-items:center; gap:6px; padding:2px 9px; border-radius:99px;
  background:rgba(32,107,196,.12); color:var(--nbx-blue); font-weight:600; }
.nbx-chip.ghost{ background:transparent; border:1px dashed var(--nbx-line); color:var(--nbx-muted); font-weight:500; }
.nbx-chip button{ border:0; background:transparent; color:inherit; cursor:pointer; padding:0; opacity:.65; }
.nbx-chip button:hover{ opacity:1; color:var(--nbx-red); }
.nbx-target{ font-family:var(--tblr-font-monospace,monospace); opacity:.85; max-width:55%;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

#nbx-hero{ position:relative; display:flex; align-items:center; justify-content:center; min-height:100vh;
  padding:24px 16px 72px; box-sizing:border-box; overflow:hidden; }
.nbx-aurora{ position:absolute; inset:-20%; pointer-events:none; z-index:0; filter:blur(60px); opacity:.5;
  background:
    radial-gradient(38% 42% at 22% 30%, rgba(12,166,120,.55), transparent 60%),
    radial-gradient(34% 38% at 78% 26%, rgba(32,107,196,.50), transparent 62%),
    radial-gradient(30% 34% at 62% 78%, rgba(112,72,232,.38), transparent 64%),
    radial-gradient(26% 30% at 30% 82%, rgba(214,51,108,.28), transparent 66%);
  animation:nbxdrift 26s ease-in-out infinite alternate; }
@keyframes nbxdrift{ from{ transform:translate3d(-2%,-1%,0) scale(1); } to{ transform:translate3d(3%,2%,0) scale(1.08); } }
#nbx-hero::after{ content:''; position:absolute; inset:0; z-index:1; pointer-events:none; opacity:.35;
  background-image:linear-gradient(var(--nbx-line) 1px,transparent 1px),linear-gradient(90deg,var(--nbx-line) 1px,transparent 1px);
  background-size:56px 56px; mask-image:radial-gradient(70% 60% at 50% 45%,#000,transparent 78%);
  -webkit-mask-image:radial-gradient(70% 60% at 50% 45%,#000,transparent 78%); }
.nbx-hero-inner{ position:relative; z-index:2; display:flex; flex-direction:column; align-items:center; width:100%; }
#nbx-hero .nbx-search{ width:min(880px,94vw); }
.nbx-hero-logo img{ height:42px; margin-bottom:26px; }
.nbx-hero-stats{ display:flex; align-items:center; gap:10px; margin-top:16px; font-size:12.5px; color:var(--nbx-muted); }
.nbx-hero-stats i{ color:var(--nbx-teal); margin-right:5px; }
.nbx-hero-stats .dot{ opacity:.4; }
.nbx-help{ margin-top:22px; font-size:12.5px; text-align:center; color:var(--nbx-muted); }
.nbx-help kbd{ font-size:10.5px; padding:2px 6px; border-radius:6px; border:1px solid var(--nbx-line);
  background:var(--nbx-surface); color:var(--nbx-ink); }

#nbx-menu{ position:fixed; top:calc(var(--nbx-h) + 8px); left:8px; width:min(1200px,calc(100vw - 16px));
  max-height:calc(100vh - var(--nbx-h) - 28px); overflow:auto; z-index:1085; display:none; padding:14px;
  border-radius:16px; border:1px solid var(--nbx-line); background:var(--nbx-surface);
  box-shadow:0 30px 70px rgba(8,20,40,.26); scrollbar-width:thin; scrollbar-color:var(--nbx-blue) transparent; }
#nbx-menu.open{ display:block; animation:nbxpop .18s cubic-bezier(.2,.8,.3,1); }
#nbx-menu::-webkit-scrollbar{ width:10px; }
#nbx-menu::-webkit-scrollbar-track{ background:transparent; }
#nbx-menu::-webkit-scrollbar-thumb{ border-radius:99px; border:3px solid var(--nbx-surface);
  background:linear-gradient(180deg,var(--nbx-blue),var(--nbx-violet)); }
.nbx-menu-head{ display:flex; align-items:center; gap:12px; margin-bottom:12px; position:sticky; top:-14px;
  padding:6px 0; background:var(--nbx-surface); z-index:2; }
.nbx-menu-filter{ flex:1 1 auto; padding:9px 13px; font-size:14px; border-radius:11px; outline:none;
  border:1px solid var(--nbx-line); background:var(--nbx-bg); color:var(--nbx-ink); }
.nbx-menu-filter:focus{ border-color:var(--nbx-blue); box-shadow:0 0 0 3px rgba(32,107,196,.15); }
.nbx-menu-hint{ font-size:11.5px; color:var(--nbx-muted); white-space:nowrap; }
.nbx-menu-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(252px,1fr)); gap:10px 18px; }
.nbx-menu-col{ break-inside:avoid; }
.nbx-menu-title{ display:flex; align-items:center; gap:8px; font-weight:750; font-size:12.5px; padding:5px 6px;
  color:var(--nbx-blue); border-bottom:1px solid var(--nbx-line); margin-bottom:3px; }
.nbx-menu-row{ display:flex; align-items:center; gap:4px; border-radius:8px; padding:1px 4px; }
.nbx-menu-row:hover{ background:var(--nbx-hover); }
.nbx-menu-link{ flex:1 1 auto; font-size:13px; padding:5px 2px; color:var(--nbx-ink); text-decoration:none;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.nbx-menu-link:hover{ color:var(--nbx-blue); }
.nbx-mini{ font-size:12px; opacity:0; color:var(--nbx-muted); padding:2px 4px; transition:opacity .12s; }
.nbx-menu-row:hover .nbx-mini{ opacity:.85; }
.nbx-mini:hover{ color:var(--nbx-green); }
.nbx-menu-empty{ padding:18px; color:var(--nbx-muted); }

#nbx-pill{ position:fixed; left:14px; bottom:14px; z-index:1090; display:none; align-items:center; gap:6px;
  padding:7px 14px; font-size:12px; border-radius:99px; cursor:pointer; opacity:.6; transition:opacity .15s;
  border:1px solid var(--nbx-line); background:var(--nbx-surface); color:var(--nbx-muted); }
#nbx-pill:hover{ opacity:1; color:var(--nbx-blue); }
html.nbx-home #nbx-pill, html:not(.nbx-ui-on):not(.nbx-home) #nbx-pill{ display:inline-flex; }

@media (max-width:992px){ .nbx-crumbs{ display:none; } .nbx-hdr-search{ flex:1 1 auto; } }
@media (max-width:640px){ .nbx-search.hero .nbx-input{ font-size:16px; padding:15px 74px 15px 44px; }
  .nbx-kbd-hint{ display:none; } .nbx-hero-stats{ flex-wrap:wrap; justify-content:center; } .nbx-objid{ display:none; } }
@media (prefers-reduced-motion:reduce){ .nbx-aurora{ animation:none; } .nbx-list.open,#nbx-menu.open{ animation:none; } }
@media print{ #nbx-header,#nbx-menu,#nbx-pill,#nbx-hero{ display:none !important; } html.nbx-ui-on body{ padding-top:0; } }
`;

const style = document.createElement('style');
style.id = 'nbx-style'; style.textContent = CSS;
(document.head || document.documentElement).appendChild(style);
if (getMode() === 'modern') document.documentElement.classList.add(isHome() ? 'nbx-home' : 'nbx-ui-on');

/* ---------- watchdog / hotkeys ---------- */
let tick = null, sig = '';
function watchdog() {
  try {
    if (getMode() !== 'modern') return;
    const need = isHome() ? 'nbx-hero' : 'nbx-header';
    if (!document.getElementById(need) || !document.getElementById('nbx-pill')) { clearTimeout(tick); tick = setTimeout(apply, 60); return; }
    if (!MENU.length) {
      MENU = readMenu();
      if (MENU.length) { headerField && headerField.refresh(false); heroField && heroField.refresh(false); }
    }
    const s = location.pathname + '|' + (document.querySelector('#page-content h1.page-title')?.textContent || '')
      + '|' + document.querySelectorAll('#page-content .page-header ol.breadcrumb li').length;
    if (s !== sig) {
      sig = s; crumbsExpanded = false;
      const box = document.querySelector('#nbx-header .nbx-crumbs');
      if (box) renderCrumbs(box);
    }
    healFieldBreadcrumbs();
  } catch (e) { /* нет вмешательства в работу NetBox */ }
}
function boot() {
  apply();
  let mo = null;
  mo = new MutationObserver(() => { clearTimeout(tick); tick = setTimeout(watchdog, 80); });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('htmx:afterSettle', () => setTimeout(watchdog, 40));
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
window.addEventListener('pageshow', () => setTimeout(apply, 0));

document.addEventListener('keydown', (e) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
  if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyZ') { e.preventDefault(); toggleMode(); return; }
  if (getMode() !== 'modern') return;
  if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyM') { e.preventDefault(); toggleMenu(); return; }
  if (e.key === 'Escape' && menuPanel && menuPanel.classList.contains('open')) { closeMenu(); return; }
  if (!typing && (e.key === '/' || (e.ctrlKey && e.code === 'KeyK'))) {
    const f = isHome() ? heroField : headerField;
    if (f) { e.preventDefault(); f.focus(); }
  }
});

window.NBX = {
  CFG, MENU: () => MENU, reloadMenu: () => { MENU = readMenu(); headerField && headerField.refresh(false); return MENU.length; },
  apiFor, apiSearch, apiDead, apiCache, toggleMode, openMenu, healFieldBreadcrumbs, LS,
  restore: () => { setMode('classic'); apply(); },
};
})();
