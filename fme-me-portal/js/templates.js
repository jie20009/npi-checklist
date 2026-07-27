/* ============================================================
 * FME-ME Portal v2.0 — Templates Page Logic
 * v2.0: Adds "填写" button for form-fillable xlsx templates
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

  const tbody = document.getElementById('tpl-tbody');
  tbody.innerHTML = `<tr><td colspan="7" class="loading-row">加载中…</td></tr>`;

  const data = await loadData();
  if (!data) {
    tbody.innerHTML = `<tr><td colspan="7" class="error-row">数据加载失败</td></tr>`;
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
  document.getElementById('tpl-result-meta').innerHTML =
    `共 ${filtered.length} 个模板 · <span class="fillable-count">${fillableCount} 个可在线填写</span>`;

  const tbody = document.getElementById('tpl-tbody');
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-row">无匹配模板</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(t => {
    const domain = allDomains.find(d => d.id === t.domain);
    const dColor = domain ? domain.color : '#1F4E78';
    const dTint = dColor + '20';
    const typeLabel = { xlsx: 'Excel', docx: 'Word', md: 'MD' }[t.type] || t.type;
    const typeIcon = { xlsx: '📊', docx: '📄', md: '📝' }[t.type] || '📁';
    const localPath = t.local_path || t.file || '';
    const isFillable = FORM_FILLABLE.has(t.id);
    return `
      <tr>
        <td class="id-cell">
          ${escapeHtml(t.id)}
          ${isFillable ? '<span class="fillable-badge" title="可在线填写">✏</span>' : ''}
        </td>
        <td class="name-cell">
          <div class="name-cn">${escapeHtml(t.name)}</div>
          ${t.name_en ? `<div class="name-en">${escapeHtml(t.name_en)}</div>` : ''}
        </td>
        <td>
          <span class="domain-badge" style="--domain-color:${dColor};--domain-tint:${dTint};">${escapeHtml(t.domain)}</span>
        </td>
        <td class="type-cell">${typeIcon} ${typeLabel}</td>
        <td class="purpose-cell" title="${escapeHtml(t.purpose || '')}">${escapeHtml(t.purpose || '—')}</td>
        <td>${formatFileSize(t.file_size)}</td>
        <td class="action-cell">
          ${isFillable ? `<a href="form.html?t=${encodeURIComponent(t.id)}" class="fill-btn">填写</a>` : ''}
          <button class="copy-btn" data-path="${escapeHtml(localPath)}">复制路径</button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await copyToClipboard(btn.dataset.path);
      if (ok) {
        btn.classList.add('copied');
        const original = btn.textContent;
        btn.textContent = '已复制';
        setTimeout(() => { btn.classList.remove('copied'); btn.textContent = original; }, 1500);
      } else {
        showToast('复制失败', 1500);
      }
    });
  });
}
