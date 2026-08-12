/* ============================================================
 * FME-ME Portal v2.1 — Overview Page Logic
 * Adds: SVG icons, sparklines, breadcrumb, data freshness,
 *       hover effects (CSS-driven), recent views chip row.
 * ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  renderTopNav('overview');
  renderFooter();

  // Breadcrumb (i18n)
  const bcSlot = document.getElementById('breadcrumb-slot');
  if (bcSlot) bcSlot.innerHTML = renderBreadcrumb([
    { label: t('breadcrumb.home', '首页'), href: 'index.html' },
    { label: t('breadcrumb.overview', '总览'), href: 'index.html' }
  ]);

  // Recent views chips (if any)
  if (window.App && window.App.Recent) {
    const recent = App.Recent.list().filter(r => r.type === 'page' && r.id !== 'overview').slice(0, 5);
    if (recent.length > 0) {
      const rc = document.createElement('div');
      rc.className = 'recent-chips';
      rc.innerHTML = `<span style="font-size:11px;color:var(--text-light);margin-right:4px;">${escapeHtml(t('recent.label', '最近'))}:</span>` +
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
    kpiGrid.innerHTML = '<div class="error">' + escapeHtml(t('error.data.load', '数据加载失败，请检查 data/*.json 文件')) + '</div>';
    domainGrid.innerHTML = '';
    typeStats.innerHTML = '';
    return;
  }

  // Cache for i18n re-render
  window.__overviewData = data;
  renderKPIs(data);
  renderDomains(data);
  renderTypeStats(data);
  renderDataFreshness(data);

  // v2.1.1: re-render on language switch (data is cached, but it contains
  // all language fields — re-rendering picks the right one based on I18n.current)
  document.addEventListener('i18n:changed', async () => {
    // Refresh breadcrumb (i18n)
    const slot = document.getElementById('breadcrumb-slot');
    if (slot) {
      slot.innerHTML = renderBreadcrumb([
        { label: t('breadcrumb.home', '首页'), href: 'index.html' },
        { label: t('breadcrumb.overview', '总览'), href: 'index.html' }
      ]);
    }
    if (window.__overviewData) {
      renderKPIs(window.__overviewData);
      renderDomains(window.__overviewData);
      renderTypeStats(window.__overviewData);
      renderDataFreshness(window.__overviewData);
    }
  });
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
    { label: t('kpi.domains', '管理域'), value: totalDomains, sub: t('kpi.domains.sub', '{N} 个活跃', { N: activeDomains }), icon: 'i-dashboard', spark: domainCounts },
    { label: t('kpi.templates', '模板总数'), value: totalTemplates, sub: t('kpi.templates.sub', 'xlsx · docx · md'), icon: 'i-grid', spark: typeCounts },
    { label: t('kpi.courses', '课程总数'), value: totalCourses, sub: t('kpi.courses.sub', '跨 9 个阶段'), icon: 'i-book', spark: phaseCounts },
    { label: t('kpi.hours', '总课时(小时)'), value: totalHours.toFixed(1), sub: t('kpi.hours.sub', '含实操与报告'), icon: 'i-clock', spark: hourByPhase },
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

  const lang = (window.App && window.App.I18n) ? window.App.I18n.current : 'zh';
  // Pick a localized name field. zh→name, en→name_en, vi→name_vi (fallback name_en).
  const pickName = (d) => {
    if (lang === 'en') return d.name_en || d.name || '';
    if (lang === 'vi') return d.name_vi || d.name_en || d.name || '';
    return d.name || d.name_en || '';
  };
  const pickDesc = (d) => {
    // v2.1.1: only show description in the current language; if missing, show '—'
    // (avoid showing Chinese description under an English UI)
    if (lang === 'en') return d.description_en || '';
    if (lang === 'vi') return d.description_vi || d.description_en || '';
    return d.description || '';
  };
  // Sub-name (English alongside Chinese for bilingual readability)
  // Only show sub-name in Chinese mode; in en/vi modes the main name is already localized.
  const pickSubName = (d) => {
    if (lang === 'zh' && d.name_en) return d.name_en;
    return '';
  };

  const tbd = t('domain.tbd', '待定');
  const lblTemplates = t('domain.templates_count', '模板');
  const lblOwner = t('domain.owner', '负责人');
  const lblBackup = t('domain.backup', '备份');

  document.getElementById('domain-grid').innerHTML = domains.domains.map(d => {
    const tplCount = tplCountByDomain[d.id] || 0;
    const owners = d.owner && d.owner.length ? d.owner.join('、') : tbd;
    const name = pickName(d);
    const subName = pickSubName(d);
    return `
      <div class="domain-card" style="--domain-color:${d.color};">
        <div class="header">
          <div class="id-name">
            <div class="id">${escapeHtml(d.id)}</div>
            <div class="name">${escapeHtml(name)}</div>
            ${subName ? `<div class="name-en">${escapeHtml(subName)}</div>` : ''}
          </div>
          ${getStatusDot(d.status)}
        </div>
        <div class="desc">${escapeHtml(pickDesc(d) || t('domain.desc.fallback', '—'))}</div>
        <div class="meta">
          <div class="meta-item">${iconSvg('i-file')} ${escapeHtml(lblTemplates)}: <strong>${tplCount}</strong></div>
          <div class="meta-item">${iconSvg('i-user')} ${escapeHtml(lblOwner)}: ${escapeHtml(owners)}</div>
        </div>
        <div class="owner-row">
          <span>${escapeHtml(lblBackup)}: ${escapeHtml(d.backup || tbd)}</span>
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

  // v2.1.1: type labels via i18n (with Chinese fallback)
  const typeLabels = {
    xlsx: t('type.excel', 'Excel'),
    docx: t('type.word', 'Word'),
    md:   t('type.markdown', 'Markdown'),
  };
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
        <div class="label">${escapeHtml(it.label)} · ${it.pct}%</div>
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
  // v2.1.1: write to dedicated #freshness-slot so i18n.apply() won't wipe it
  const slot = document.getElementById('freshness-slot');
  if (!slot) return;
  const cls = days <= 7 ? 'fresh' : days <= 30 ? 'stale' : 'very-stale';
  let label;
  if (days === 0) label = t('freshness.today', '今日更新');
  else if (days === 1) label = t('freshness.day_ago', '1 天前更新');
  else label = t('freshness.days_ago', '{N} 天前更新', { N: days });
  slot.innerHTML = ' · <span class="data-freshness ' + cls + '">' + iconSvg('i-clock') + ' ' + escapeHtml(label) + '</span>';
}
