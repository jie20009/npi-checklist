/* ============================================================
 * FME-ME Portal v2.0 — Templates Page Logic
 * v2.0: Adds "填写" button for form-fillable xlsx templates
 * v2.1.1: i18n support (zh/vi/en) via t() + i18n:changed re-render
 * ============================================================ */

// Templates that have a JSON schema in schemas/ directory → form-fillable
const FORM_FILLABLE = new Set([
  'T02','T03','T04','T05','T07','T09','T10',
  'T12','T13','T17','T18','T19','T20','T21','T22','T23'
]);

let allTemplates = [];
let allDomains = [];
let tplSearch = '';
let tplDomain = '';
let tplType = '';

document.addEventListener('DOMContentLoaded', async () => {
  renderTopNav('templates');
  renderFooter();

  // Breadcrumb
  const bcSlot = document.getElementById('breadcrumb-slot');
  if (bcSlot) bcSlot.innerHTML = renderBreadcrumb([
    { label: t('breadcrumb.home', '首页'), href: 'index.html' },
    { label: t('breadcrumb.templates', '模板库'), href: 'templates.html' }
  ]);

  const tbody = document.getElementById('tpl-tbody');
  tbody.innerHTML = `<tr><td colspan="7" class="loading-row">${escapeHtml(t('state.loading', '加载中…'))}</td></tr>`;

  const data = await loadData();
  if (!data) {
    tbody.innerHTML = `<tr><td colspan="7" class="error-row">${escapeHtml(t('error.data.load.simple', '数据加载失败'))}</td></tr>`;
    return;
  }

  allTemplates = data.templates.templates;
  allDomains = data.domains.domains;

  // Populate domain filter
  const domainFilter = document.getElementById('tpl-domain-filter');
  allDomains.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = `${d.id} ${d.name}`;
    domainFilter.appendChild(opt);
  });

  // Pre-select via URL param (?domain=M01)
  const urlDomain = getUrlParam('domain');
  if (urlDomain) {
    tplDomain = urlDomain;
    domainFilter.value = urlDomain;
  }

  renderTemplates();

  document.getElementById('tpl-search').addEventListener('input', e => {
    tplSearch = e.target.value.trim().toLowerCase();
    renderTemplates();
  });
  document.getElementById('tpl-domain-filter').addEventListener('change', e => {
    tplDomain = e.target.value;
    renderTemplates();
  });
  document.getElementById('tpl-type-filter').addEventListener('change', e => {
    tplType = e.target.value;
    renderTemplates();
  });

  // v2.1.1: re-render on language change
  document.addEventListener('i18n:changed', () => {
    if (bcSlot) bcSlot.innerHTML = renderBreadcrumb([
      { label: t('breadcrumb.home', '首页'), href: 'index.html' },
      { label: t('breadcrumb.templates', '模板库'), href: 'templates.html' }
    ]);
    renderTemplates();
  });
});

function renderTemplates() {
  const filtered = allTemplates.filter(t => {
    if (tplDomain && t.domain !== tplDomain) return false;
    if (tplType && t.type !== tplType) return false;
    if (tplSearch) {
      const hay = `${t.id} ${t.name} ${t.name_en || ''} ${t.purpose || ''}`.toLowerCase();
      if (!hay.includes(tplSearch)) return false;
    }
    return true;
  });

  // v2.0: Count form-fillable templates
  const fillableCount = filtered.filter(t => FORM_FILLABLE.has(t.id)).length;
  const metaEl = document.getElementById('tpl-result-meta');
  if (metaEl) {
    metaEl.innerHTML =
      `${escapeHtml(t('template.count', '共 {N} 个模板', { N: filtered.length }))} · ` +
      `<span class="fillable-count">${escapeHtml(t('template.fillable.count', '{N} 个可在线填写', { N: fillableCount }))}</span>`;
  }

  const tbody = document.getElementById('tpl-tbody');
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-row">${escapeHtml(t('state.empty.templates', '无匹配模板'))}</td></tr>`;
    return;
  }

  const fillLabel = t('action.fill', '填写');
  const fillTitle = t('action.fillable.title', '可在线填写');
  const openLabel = t('action.open', '📂 打开');
  const openTitle = t('action.open.title', '点击打开文件（仅本地访问有效；在线版会被浏览器拦截，请改用「复制路径」）');
  const copyLabel = t('action.copy.path', '复制路径');

  tbody.innerHTML = filtered.map(item => {
    const domain = allDomains.find(d => d.id === item.domain);
    const dColor = domain ? domain.color : '#1F4E78';
    const dTint = dColor + '20';
    const typeLabel = { xlsx: t('type.excel', 'Excel'), docx: t('type.word', 'Word'), md: t('type.markdown', 'MD') }[item.type] || item.type;
    const typeIcon = { xlsx: 'i-excel', docx: 'i-word', md: 'i-md' }[item.type] || 'i-file';
    const localPath = item.local_path || item.file || '';
    const isFillable = FORM_FILLABLE.has(item.id);
    const fileUrl = pathToFileUrl(localPath);
    return `
      <tr>
        <td class="id-cell">
          ${escapeHtml(item.id)}
          ${isFillable ? `<span class="fillable-badge" title="${escapeHtml(fillTitle)}">✏</span>` : ''}
        </td>
        <td class="name-cell">
          <div class="name-cn">${escapeHtml(item.name)}</div>
          ${item.name_en ? `<div class="name-en">${escapeHtml(item.name_en)}</div>` : ''}
        </td>
        <td>
          <span class="domain-badge" style="--domain-color:${dColor};--domain-tint:${dTint};">${escapeHtml(item.domain)}</span>
        </td>
        <td class="type-cell"><svg class="icon" viewBox="0 0 24 24"><use href="icons/icon.svg#${typeIcon}"/></svg> ${escapeHtml(typeLabel)}</td>
        <td class="purpose-cell" title="${escapeHtml(item.purpose || '')}">${escapeHtml(item.purpose || '—')}</td>
        <td>${formatFileSize(item.file_size)}</td>
        <td class="action-cell">
          ${isFillable ? `<a href="form.html?t=${encodeURIComponent(item.id)}" class="fill-btn">${escapeHtml(fillLabel)}</a>` : ''}
          ${fileUrl ? `<a href="${fileUrl}" class="open-btn" target="_blank" rel="noopener" title="${escapeHtml(openTitle)}">${escapeHtml(openLabel)}</a>` : ''}
          <button class="copy-btn" data-path="${escapeHtml(localPath)}">${escapeHtml(copyLabel)}</button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await copyToClipboard(btn.dataset.path);
      if (ok) {
        btn.classList.add('copied');
        btn.textContent = t('action.copied', '已复制');
        setTimeout(() => { btn.classList.remove('copied'); btn.textContent = t('action.copy.path', '复制路径'); }, 1500);
      } else {
        showToast(t('action.copy.failed', '复制失败'), 1500);
      }
    });
  });
}
