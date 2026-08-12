/* ============================================================
 * FME-ME Portal v1.0 — Shared JS Utilities
 * ============================================================ */

const PHASE_COLORS = {
  '新人基础': { color: '#43A047', tint: '#E8F5E9' },
  'ME基础':   { color: '#1976D2', tint: '#E3F2FD' },
  'ME进阶':   { color: '#FB8C00', tint: '#FFF3E0' },
  'ME包装':   { color: '#8E24AA', tint: '#F3E5F5' },
  'MERD':     { color: '#D81B60', tint: '#FCE4EC' },
  'RD资料':   { color: '#00ACC1', tint: '#E0F7FA' },
  '通识':     { color: '#7CB342', tint: '#F1F8E9' },
  '报告':     { color: '#F9A825', tint: '#FFF8E1' },
  '实操':     { color: '#F4511E', tint: '#FBE9E7' },
};

const STATUS_MAP = {
  'active':    { class: 'active',    i18n: 'status.active',    zh: '活跃' },
  'warning':   { class: 'warning',   i18n: 'status.warning',   zh: '待办' },
  'pending':   { class: 'pending',   i18n: 'status.pending',   zh: '阻塞' },
  'planning':  { class: 'planning',  i18n: 'status.planning',  zh: '规划中' },
};

function getPhaseColor(phase) {
  return PHASE_COLORS[phase] || { color: '#1F4E78', tint: '#E3F2FD' };
}

function getStatusInfo(status) {
  return STATUS_MAP[status] || STATUS_MAP['planning'];
}

function getStatusDot(status) {
  const info = getStatusInfo(status);
  const label = t(info.i18n, info.zh);
  return `<span class="status-dot ${info.class}">${escapeHtml(label)}</span>`;
}

/**
 * Global i18n helper. Uses window.App.I18n if available; falls back to
 * the provided fallback string. Call from any page script.
 *   t('kpi.domains', '管理域')
 */
function t(key, fallback, vars) {
  if (window.App && window.App.I18n && typeof window.App.I18n.t === 'function') {
    const result = window.App.I18n.t(key, vars);
    if (result !== undefined && result !== null && result !== '') return result;
  }
  // Fallback may itself contain {N}-style placeholders
  let s = fallback || key;
  if (vars && s) {
    Object.keys(vars).forEach(k => { s = s.replace('{' + k + '}', String(vars[k])); });
  }
  return s;
}

function getDomainColor(domains, domainId) {
  const d = domains.domains.find(x => x.id === domainId);
  return d ? d.color : '#1F4E78';
}

function getDomainTint(color) {
  // Simple tint: lighten by mixing with white
  return color + '20';
}

async function loadData() {
  try {
    // v2.1.1: cache:'no-cache' ensures we get the latest JSON (especially
    // important for i18n language data and domain descriptions that ship
    // with the portal). Browser still caches but always revalidates.
    const [statsRes, domainsRes, coursesRes, templatesRes] = await Promise.all([
      fetch('data/stats.json', { cache: 'no-cache' }),
      fetch('data/domains.json', { cache: 'no-cache' }),
      fetch('data/courses.json', { cache: 'no-cache' }),
      fetch('data/templates.json', { cache: 'no-cache' }),
    ]);
    if (!statsRes.ok || !domainsRes.ok || !coursesRes.ok || !templatesRes.ok) {
      throw new Error('Failed to load one or more JSON files');
    }
    const stats = await statsRes.json();
    const domains = await domainsRes.json();
    const courses = await coursesRes.json();
    const templates = await templatesRes.json();
    return { stats, domains, courses, templates };
  } catch (err) {
    console.error('Load data failed:', err);
    return null;
  }
}

function renderTopNav(activePage) {
  const nav = document.querySelector('.top-nav');
  if (!nav) return;
  const pages = [
    { id: 'overview', href: 'index.html', label: '总览', i18n: 'nav.overview' },
    { id: 'training', href: 'training.html', label: '培训', i18n: 'nav.training' },
    { id: 'templates', href: 'templates.html', label: '模板', i18n: 'nav.templates' },
  ];
  const links = pages.map(p =>
    `<a href="${p.href}" class="${p.id === activePage ? 'active' : ''}" data-i18n="${p.i18n}">${p.label}</a>`
  ).join('');
  nav.innerHTML = `
    <div class="brand">FME-ME</div>
    <nav class="nav-links">${links}</nav>
    <div class="last-updated">v2.1.1 · 2026-08-12</div>
  `;
}

function renderFooter() {
  const footer = document.querySelector('.footer');
  if (!footer) return;
  footer.innerHTML = `
    © 2026 Pegatron BU6 FME-ME ｜ 数据源：网络共享盘 ｜ 静态看板 v2.1.1
  `;
}

function formatFileSize(bytes) {
  if (!bytes || bytes < 0) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function showSkeleton(container, count, cardClass) {
  if (!container) return;
  const cls = cardClass || 'skeleton-card';
  const html = Array.from({ length: count }, () =>
    `<div class="skeleton ${cls}"></div>`
  ).join('');
  container.innerHTML = html;
}

function showToast(message, duration) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration || 1800);
}

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    // Fallback below
  }
  // Legacy fallback
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e2) {
    return false;
  }
}

function getUrlParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function truncate(str, maxLen) {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...';
}

/**
 * Convert a Windows local path to a file:// URL for hyperlink use.
 *   D:\path\file.md       → file:///D:/path/file.md
 *   \\server\share\path   → file://server/share/path
 * Returns '' if the input is not a recognized Windows absolute path,
 * so callers can omit the "open" button when there is nothing to open.
 *
 * Note: clicking a file:// link from an https:// origin is blocked by
 * browsers (mixed-content security). This only works when the portal
 * is served from http://localhost or opened as a local file.
 */
function pathToFileUrl(p) {
  if (!p) return '';
  const norm = String(p).replace(/\\/g, '/');
  if (norm.startsWith('//')) {
    return 'file:' + encodeURI(norm);
  }
  if (/^[A-Za-z]:\//.test(norm)) {
    return 'file:///' + encodeURI(norm);
  }
  return '';
}
