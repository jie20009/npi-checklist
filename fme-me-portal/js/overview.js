/* ============================================================
 * FME-ME Portal v1.0 — Overview Page Logic
 * ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  renderTopNav('overview');
  renderFooter();

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
});

function renderKPIs(data) {
  const { stats, domains, courses, templates } = data;
  const totalCourses = courses.courses.length;
  const totalHours = courses.courses.reduce((s, c) => s + (c.duration_hours || 0), 0);
  const totalTemplates = templates.templates.length;
  const totalDomains = domains.domains.length;
  const activeDomains = domains.domains.filter(d => d.status === 'active').length;

  const kpis = [
    { label: '管理域', value: totalDomains, sub: `${activeDomains} 个活跃`, icon: 'M' },
    { label: '模板总数', value: totalTemplates, sub: 'xlsx · docx · md', icon: 'T' },
    { label: '课程总数', value: totalCourses, sub: '跨 9 个阶段', icon: 'C' },
    { label: '总课时(小时)', value: totalHours.toFixed(1), sub: '含实操与报告', icon: 'H' },
  ];

  document.getElementById('kpi-grid').innerHTML = kpis.map(k => `
    <div class="kpi-card">
      <div class="icon">${k.icon}</div>
      <div>
        <div class="value">${k.value}</div>
        <div class="label">${k.label}</div>
        <div class="sub-label">${k.sub}</div>
      </div>
    </div>
  `).join('');
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
          <div class="meta-item">📋 模板: <strong>${tplCount}</strong></div>
          <div class="meta-item">👤 负责人: ${escapeHtml(owners)}</div>
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
  const typeIcons = { xlsx: '📊', docx: '📄', md: '📝' };
  const total = templates.templates.length;

  const items = Object.entries(counts).map(([type, count]) => ({
    type,
    label: typeLabels[type] || type,
    icon: typeIcons[type] || '📁',
    count,
    pct: total ? ((count / total) * 100).toFixed(0) : 0,
  })).sort((a, b) => b.count - a.count);

  document.getElementById('type-stats').innerHTML = items.map(it => `
    <div class="type-card">
      <div class="icon">${it.icon}</div>
      <div>
        <div class="value">${it.count}</div>
        <div class="label">${it.label} · ${it.pct}%</div>
      </div>
    </div>
  `).join('');
}
