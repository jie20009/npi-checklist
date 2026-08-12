/* ============================================================
 * FME-ME Portal v2.1 — Overview Page Logic
 * Adds: SVG icons, sparklines, breadcrumb, data freshness,
 *       hover effects (CSS-driven), recent views chip row.
 * ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  renderTopNav('overview');
  renderFooter();

  // Breadcrumb
  const bcSlot = document.getElementById('breadcrumb-slot');
  if (bcSlot) bcSlot.innerHTML = renderBreadcrumb([
    { label: '首页', href: 'index.html' },
    { label: '总览', href: 'index.html' }
  ]);

  // Recent views chips (if any)
  if (window.App && window.App.Recent) {
    const recent = App.Recent.list().filter(r => r.type === 'page' && r.id !== 'overview').slice(0, 5);
    if (recent.length > 0) {
      const rc = document.createElement('div');
      rc.className = 'recent-chips';
      rc.innerHTML = `<span style="font-size:11px;color:var(--text-light);margin-right:4px;">最近:</span>` +
        recent.map(r => `<a class="recent-chip" href="${r.href}"><svg class="icon" viewBox="0 0 24 24"><use href="icons/icon.svg#i-clock"/></svg>${escapeHtml(r.label)}</a>`).join('');
      bcSlot.appendChild(rc);
    }
  }

  const kpiGrid = document.getElementById('kpi-grid');
  const domainGrid = document.getElementById('domain-grid');
  const typeStats = document.getElementById('type-stats');

  showSkeleton(kpiGrid, 4, 'kpi-card');
  showSkeleton(domainGrid, 13, 'domain-card');
  showSkeleton(typeStats, 3, 'type-card');

  const data = await loadData();
  if (!data) {
    kpiGrid.innerHTML = '<div class="error">数据加载失败，请检查 data/*.json 文件</div>';
    domainGrid.innerHTML = '';
    typeStats.innerHTML = '';
    return;
  }

  renderKPIs(data);
  renderDomains(data);
  renderTypeStats(data);
  renderDataFreshness(data);
});

function iconSvg(name) {
  return `<svg class="icon" viewBox="0 0 24 24"><use href="icons/icon.svg#${name}"/></svg>`;
}

function renderKPIs(data) {
  const { stats, domains, courses, templates } = data;
  const totalCourses = courses.courses.length;
  const totalHours = courses.courses.reduce((s, c) => s + (c.duration_hours || 0), 0);
  const totalTemplates = templates.templates.length;
  const totalDomains = domains.domains.length;
  const activeDomains = domains.domains.filter(d => d.status === 'active').length;

  // Sparkline data: phases distribution for courses, type dist for templates, etc.
  const phaseCounts = Object.values(stats.courses_by_phase || {});
  const typeCounts = Object.values(stats.templates_by_type || {});
  const domainCounts = Object.values(stats.templates_by_domain || {});
  const hourByPhase = Object.values(stats.hours_by_phase || {});

  const kpis = [
    { label: '管理域', value: totalDomains, sub: `${activeDomains} 个活跃`, icon: 'i-dashboard', spark: domainCounts },
    { label: '模板总数', value: totalTemplates, sub: 'xlsx · docx · md', icon: 'i-grid', spark: typeCounts },
    { label: '课程总数', value: totalCourses, sub: '跨 9 个阶段', icon: 'i-book', spark: phaseCounts },
    { label: '总课时(小时)', value: totalHours.toFixed(1), sub: '含实操与报告', icon: 'i-clock', spark: hourByPhase },
  ];

  document.getElementById('kpi-grid').innerHTML = kpis.map(k => `
    <div class="kpi-card">
      <div class="icon">${iconSvg(k.icon)}</div>
      <div>
        <div class="value">${k.value}</div>
        <div class="label">${k.label}</div>
        <div class="sub-label">${k.sub}</div>
      </div>
      ${k.spark && k.spark.length ? `<div class="sparkline">${sparklineSvg(k.spark)}</div>` : ''}
    </div>
  `).join('');
}

// Minimal pure-SVG sparkline (no library)
function sparklineSvg(values) {
  if (!values || values.length === 0) return '';
  const w = 100, h = 28;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <polyline points="${pts.join(' ')}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>
  </svg>`;
}

function renderDomains(data) {
  const { domains, templates } = data;
  const tplCountByDomain = {};
  templates.templates.forEach(t => {
    tplCountByDomain[t.domain] = (tplCountByDomain[t.domain] || 0) + 1;
  });

  document.getElementById('domain-grid').innerHTML = domains.domains.map(d => {
    const tplCount = tplCountByDomain[d.id] || 0;
    const owners = d.owner && d.owner.length ? d.owner.join('、') : '待定';
    return `
      <div class="domain-card" style="--domain-color:${d.color};">
        <div class="header">
          <div class="id-name">
            <div class="id">${escapeHtml(d.id)}</div>
            <div class="name">${escapeHtml(d.name)}</div>
            <div class="name-en">${escapeHtml(d.name_en || '')}</div>
          </div>
          ${getStatusDot(d.status)}
        </div>
        <div class="desc">${escapeHtml(d.description || '')}</div>
        <div class="meta">
          <div class="meta-item">${iconSvg('i-file')} 模板: <strong>${tplCount}</strong></div>
          <div class="meta-item">${iconSvg('i-user')} 负责人: ${escapeHtml(owners)}</div>
        </div>
        <div class="owner-row">
          <span>备份: ${escapeHtml(d.backup || '待定')}</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderTypeStats(data) {
  const { templates } = data;
  const counts = {};
  templates.templates.forEach(t => {
    counts[t.type] = (counts[t.type] || 0) + 1;
  });

  const typeLabels = { xlsx: 'Excel', docx: 'Word', md: 'Markdown' };
  const typeIcons = { xlsx: 'i-excel', docx: 'i-word', md: 'i-md' };
  const total = templates.templates.length;

  const items = Object.entries(counts).map(([type, count]) => ({
    type,
    label: typeLabels[type] || type,
    icon: typeIcons[type] || 'i-file',
    count,
    pct: total ? ((count / total) * 100).toFixed(0) : 0,
  })).sort((a, b) => b.count - a.count);

  document.getElementById('type-stats').innerHTML = items.map(it => `
    <div class="type-card">
      <div class="icon">${iconSvg(it.icon)}</div>
      <div>
        <div class="value">${it.count}</div>
        <div class="label">${it.label} · ${it.pct}%</div>
      </div>
    </div>
  `).join('');
}

function renderDataFreshness(data) {
  const stats = data.stats || {};
  const genAt = stats.data_generated_at || stats.last_updated;
  if (!genAt) return;
  const genDate = new Date(genAt);
  if (isNaN(genDate.getTime())) return;
  const days = Math.floor((Date.now() - genDate.getTime()) / (24 * 60 * 60 * 1000));
  const subtitle = document.querySelector('.page-header .subtitle');
  if (!subtitle) return;
  const cls = days <= 7 ? 'fresh' : days <= 30 ? 'stale' : 'very-stale';
  const label = days === 0 ? '今日更新' : days === 1 ? '1 天前更新' : `${days} 天前更新`;
  const chip = `<span class="data-freshness ${cls}">${iconSvg('i-clock')} ${label}</span>`;
  subtitle.insertAdjacentHTML('beforeend', ' · ' + chip);
}
