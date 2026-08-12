/* ============================================================
 * FME-ME Portal v1.0 — Training Page Logic
 * v2.1.1: i18n support (zh/vi/en) via t() + i18n:changed re-render
 * ============================================================ */

let allCourses = [];
let activePhases = new Set();
let activeExam = '';
let searchKeyword = '';

document.addEventListener('DOMContentLoaded', async () => {
  renderTopNav('training');
  renderFooter();

  // Breadcrumb
  const bcSlot = document.getElementById('breadcrumb-slot');
  if (bcSlot) bcSlot.innerHTML = renderBreadcrumb([
    { label: t('breadcrumb.home', '首页'), href: 'index.html' },
    { label: t('breadcrumb.training', '培训'), href: 'training.html' }
  ]);

  const grid = document.getElementById('course-grid');
  showSkeleton(grid, 9, 'course-card');

  const data = await loadData();
  if (!data) {
    grid.innerHTML = `<div class="error">${t('error.data.load.simple', '数据加载失败')}</div>`;
    return;
  }

  allCourses = data.courses.courses;
  renderPhasePills();
  renderSidebarFilters();
  renderCourses();

  // Wire events
  document.getElementById('search-input').addEventListener('input', e => {
    searchKeyword = e.target.value.trim().toLowerCase();
    renderCourses();
  });
  document.getElementById('clear-search').addEventListener('click', () => {
    document.getElementById('search-input').value = '';
    searchKeyword = '';
    activePhases.clear();
    activeExam = '';
    renderSidebarFilters();
    renderPhasePills();
    renderCourses();
  });

  // v2.1.1: re-render on language change
  document.addEventListener('i18n:changed', () => {
    if (bcSlot) bcSlot.innerHTML = renderBreadcrumb([
      { label: t('breadcrumb.home', '首页'), href: 'index.html' },
      { label: t('breadcrumb.training', '培训'), href: 'training.html' }
    ]);
    renderPhasePills();
    renderSidebarFilters();
    renderCourses();
  });
});

function renderPhasePills() {
  const phases = [...new Set(allCourses.map(c => c.phase))];
  const counts = {};
  allCourses.forEach(c => { counts[c.phase] = (counts[c.phase] || 0) + 1; });

  const container = document.getElementById('phase-pills');
  container.innerHTML = phases.map(p => {
    const pc = getPhaseColor(p);
    const active = activePhases.has(p);
    return `
      <button class="phase-pill ${active ? 'active' : ''}"
              style="--phase-color:${pc.color};--phase-tint:${pc.tint};"
              data-phase="${escapeHtml(p)}">
        ${escapeHtml(p)} <span class="count">${counts[p]}</span>
      </button>
    `;
  }).join('');

  container.querySelectorAll('.phase-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = btn.dataset.phase;
      if (activePhases.has(p)) activePhases.delete(p);
      else activePhases.add(p);
      renderPhasePills();
      renderSidebarFilters();
      renderCourses();
    });
  });
}

function renderSidebarFilters() {
  const phases = [...new Set(allCourses.map(c => c.phase))];
  const counts = {};
  allCourses.forEach(c => { counts[c.phase] = (counts[c.phase] || 0) + 1; });

  const phaseBox = document.getElementById('phase-filter');
  const allLabel = t('action.all', '全部');
  phaseBox.innerHTML = `
    <div class="phase-item" data-phase="ALL" style="${activePhases.size === 0 ? 'font-weight:600;color:var(--primary);' : ''}">
      <div class="left">
        <div class="color-dot" style="background:var(--primary);"></div>
        <label>${escapeHtml(allLabel)}</label>
      </div>
      <span class="count">${allCourses.length}</span>
    </div>
    ${phases.map(p => {
      const pc = getPhaseColor(p);
      const active = activePhases.has(p);
      return `
      <div class="phase-item" data-phase="${escapeHtml(p)}" style="${active ? 'font-weight:600;color:var(--primary);' : ''}">
        <div class="left">
          <div class="color-dot" style="background:${pc.color};"></div>
          <label>${escapeHtml(p)}</label>
        </div>
        <span class="count">${counts[p]}</span>
      </div>
    `;
    }).join('')}
  `;

  phaseBox.querySelectorAll('.phase-item').forEach(item => {
    item.addEventListener('click', () => {
      const p = item.dataset.phase;
      if (p === 'ALL') {
        activePhases.clear();
      } else {
        if (activePhases.has(p)) activePhases.delete(p);
        else activePhases.add(p);
      }
      renderSidebarFilters();
      renderPhasePills();
      renderCourses();
    });
  });

  const exams = [...new Set(allCourses.map(c => c.exam_method || t('state.unknown', '未知')).filter(Boolean))];
  const examBox = document.getElementById('exam-filter');
  examBox.innerHTML = `
    <div class="phase-item" data-exam="" style="${!activeExam ? 'font-weight:600;color:var(--primary);' : ''}">
      <div class="left"><label>${escapeHtml(allLabel)}</label></div>
    </div>
    ${exams.map(e => `
      <div class="phase-item" data-exam="${escapeHtml(e)}" style="${activeExam === e ? 'font-weight:600;color:var(--primary);' : ''}">
        <div class="left"><label>${escapeHtml(e)}</label></div>
      </div>
    `).join('')}
  `;

  examBox.querySelectorAll('.phase-item').forEach(item => {
    item.addEventListener('click', () => {
      activeExam = item.dataset.exam || '';
      renderSidebarFilters();
      renderCourses();
    });
  });
}

function renderCourses() {
  const filtered = allCourses.filter(c => {
    if (activePhases.size > 0 && !activePhases.has(c.phase)) return false;
    if (activeExam && (c.exam_method || '') !== activeExam) return false;
    if (searchKeyword) {
      const hay = `${c.title || ''} ${c.path || ''} ${c.course_id || ''}`.toLowerCase();
      if (!hay.includes(searchKeyword)) return false;
    }
    return true;
  });

  const meta = document.getElementById('result-meta');
  meta.textContent = t('course.count', '共 {N} 门课程', { N: filtered.length });

  const grid = document.getElementById('course-grid');
  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state"><div class="icon">📭</div><div class="text">${escapeHtml(t('state.empty.courses', '无匹配课程'))}</div></div>`;
    return;
  }

  const openLabel = t('action.open', '📂 打开');
  const openTitle = t('action.open.title', '点击打开文件（仅本地访问有效；在线版会被浏览器拦截，请改用「复制路径」）');
  const copyLabel = t('action.copy.path', '复制路径');
  const noTitle = t('state.no_title', '无标题');

  grid.innerHTML = filtered.map(c => {
    const pc = getPhaseColor(c.phase);
    const path = c.path || '';
    const fileUrl = pathToFileUrl(path);
    return `
      <div class="course-card" style="--phase-color:${pc.color};--phase-tint:${pc.tint};">
        <div class="header">
          <div class="title-row">
            <span class="course-id">${escapeHtml(c.course_id || '')}</span>
            <span class="title">${escapeHtml(c.title || noTitle)}</span>
            <span class="phase-tag">${escapeHtml(c.phase)}</span>
          </div>
        </div>
        <div class="meta">
          <span class="meta-item"><svg class="icon" viewBox="0 0 24 24"><use href="icons/icon.svg#i-clock"/></svg> ${c.duration_hours ? c.duration_hours + 'h' : (c.duration || '—')}</span>
          <span class="meta-item"><svg class="icon" viewBox="0 0 24 24"><use href="icons/icon.svg#i-info"/></svg> ${escapeHtml(c.exam_method || '—')}</span>
          ${c.pass_criteria ? `<span class="meta-item"><svg class="icon" viewBox="0 0 24 24"><use href="icons/icon.svg#i-check"/></svg> ${escapeHtml(c.pass_criteria)}</span>` : ''}
        </div>
        <div class="path-row">
          <span class="path-text">${escapeHtml(path)}</span>
          ${fileUrl ? `<a href="${fileUrl}" class="open-btn" target="_blank" rel="noopener" title="${escapeHtml(openTitle)}">${escapeHtml(openLabel)}</a>` : ''}
          <button class="copy-btn" data-path="${escapeHtml(path)}">${escapeHtml(copyLabel)}</button>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.copy-btn').forEach(btn => {
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
