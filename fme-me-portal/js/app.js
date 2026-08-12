/* ============================================================
 * FME-ME Portal v2.1 — App Shell
 * Theme toggle, progress bar, keyboard shortcuts, command palette,
 * user identity nav chip, breadcrumbs, back-to-top, recent views.
 * Loaded on every page after common.js.
 * ============================================================ */

(function () {
  'use strict';

  // ============ Theme Manager ============
  const Theme = {
    KEY: 'fme_theme',
    init() {
      // Apply persisted theme on load (before paint to avoid FOUC)
      const saved = localStorage.getItem(this.KEY);
      if (saved === 'dark' || saved === 'light') {
        document.documentElement.setAttribute('data-theme', saved);
      }
    },
    toggle() {
      const html = document.documentElement;
      const current = html.getAttribute('data-theme') ||
        (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      const next = current === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      localStorage.setItem(this.KEY, next);
      // Update theme-color meta
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', next === 'dark' ? '#0F172A' : '#1F4E78');
    }
  };
  Theme.init();

  // ============ Progress Bar ============
  const Progress = {
    bar: null,
    init() {
      if (!this.bar) {
        this.bar = document.createElement('div');
        this.bar.id = 'progress-bar';
        document.body.appendChild(this.bar);
      }
    },
    start() {
      this.init();
      this.bar.classList.remove('done');
      this.bar.classList.add('active');
      this.bar.style.width = '30%';
      // Animate to 70% then wait
      setTimeout(() => { if (this.bar.classList.contains('active')) this.bar.style.width = '70%'; }, 100);
    },
    done() {
      this.init();
      this.bar.style.width = '100%';
      this.bar.classList.remove('active');
      this.bar.classList.add('done');
      setTimeout(() => {
        this.bar.classList.remove('done');
        this.bar.style.width = '0';
      }, 300);
    }
  };
  Progress.init();

  // Show progress on page unload (navigation away)
  window.addEventListener('beforeunload', () => { Progress.start(); });
  window.addEventListener('DOMContentLoaded', () => { Progress.done(); });

  // ============ User Identity ============
  const User = {
    get() {
      try { return JSON.parse(localStorage.getItem('fme_employee_profile') || '{}'); }
      catch (e) { return {}; }
    },
    initials(name) {
      if (!name) return '?';
      const parts = name.trim().split(/\s+/);
      if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    },
    clear() {
      localStorage.removeItem('fme_employee_profile');
      location.reload();
    }
  };

  // ============ Recent Views & Favorites ============
  const Recent = {
    KEY: 'fme_recent',
    MAX: 10,
    get() {
      try { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); }
      catch (e) { return []; }
    },
    add(type, id, label, href) {
      const items = this.get().filter(x => !(x.type === type && x.id === id));
      items.unshift({ type, id, label, href, ts: Date.now() });
      localStorage.setItem(this.KEY, JSON.stringify(items.slice(0, this.MAX)));
    },
    list(type, limit) {
      const items = this.get();
      const filtered = type ? items.filter(x => x.type === type) : items;
      return filtered.slice(0, limit || 5);
    }
  };

  const Favorites = {
    KEY: 'fme_favorites',
    get() {
      try { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); }
      catch (e) { return []; }
    },
    toggle(type, id, label, href) {
      const items = this.get();
      const idx = items.findIndex(x => x.type === type && x.id === id);
      if (idx >= 0) items.splice(idx, 1);
      else items.push({ type, id, label, href, ts: Date.now() });
      localStorage.setItem(this.KEY, JSON.stringify(items));
      return idx < 0;  // true if added, false if removed
    },
    has(type, id) {
      return this.get().some(x => x.type === type && x.id === id);
    }
  };

  // ============ Command Palette ============
  const Palette = {
    open() {
      let modal = document.getElementById('cmd-palette');
      if (!modal) {
        modal = this.build();
        document.body.appendChild(modal);
      }
      modal.classList.add('open');
      const input = modal.querySelector('.cmd-palette-input');
      input.value = '';
      this.render(modal, '');
      setTimeout(() => input.focus(), 50);
      document.addEventListener('keydown', this.keyHandler);
    },
    close() {
      const modal = document.getElementById('cmd-palette');
      if (modal) modal.classList.remove('open');
      document.removeEventListener('keydown', this.keyHandler);
    },
    keyHandler(e) {
      const modal = document.getElementById('cmd-palette');
      if (!modal || !modal.classList.contains('open')) return;
      if (e.key === 'Escape') { e.preventDefault(); Palette.close(); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = Array.from(modal.querySelectorAll('.cmd-item'));
        const sel = modal.querySelector('.cmd-item.selected');
        let idx = sel ? items.indexOf(sel) : -1;
        if (idx >= 0) items[idx].classList.remove('selected');
        idx = e.key === 'ArrowDown' ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
        if (items[idx]) {
          items[idx].classList.add('selected');
          items[idx].scrollIntoView({ block: 'nearest' });
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const sel = modal.querySelector('.cmd-item.selected') || modal.querySelector('.cmd-item');
        if (sel) sel.click();
      }
    },
    build() {
      const modal = document.createElement('div');
      modal.id = 'cmd-palette';
      modal.className = 'cmd-palette';
      modal.innerHTML = `
        <div class="cmd-palette-card">
          <div class="cmd-palette-input-wrap">
            <svg class="icon" viewBox="0 0 24 24"><use href="icons/icon.svg#i-search"/></svg>
            <input type="text" class="cmd-palette-input" placeholder="搜索模板、课程、页面… (Esc 关闭)" autocomplete="off">
            <kbd style="font-family:ui-monospace;font-size:10px;padding:2px 6px;background:var(--bg);border:1px solid var(--border);border-radius:3px;">ESC</kbd>
          </div>
          <div class="cmd-palette-list"></div>
        </div>
      `;
      modal.addEventListener('click', (e) => {
        if (e.target === modal) Palette.close();
      });
      const input = modal.querySelector('.cmd-palette-input');
      input.addEventListener('input', () => this.render(modal, input.value));
      return modal;
    },
    async render(modal, query) {
      const list = modal.querySelector('.cmd-palette-list');
      const q = query.trim().toLowerCase();
      const items = [];

      // Pages
      const pages = [
        { label: '总览', href: 'index.html', icon: 'i-dashboard', group: '页面' },
        { label: '培训课程', href: 'training.html', icon: 'i-book', group: '页面' },
        { label: '管理模板', href: 'templates.html', icon: 'i-grid', group: '页面' },
      ];
      pages.forEach(p => { if (!q || p.label.toLowerCase().includes(q)) items.push({ ...p, type: 'page' }); });

      // Templates + courses (async loaded)
      try {
        const res = await fetch('data/templates.json');
        if (res.ok) {
          const data = await res.json();
          data.templates.forEach(t => {
            if (!q || t.id.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || (t.name_en || '').toLowerCase().includes(q)) {
              items.push({
                label: `${t.id} ${t.name}`,
                meta: t.name_en || t.purpose || '',
                href: t.id && document.querySelector('body[data-page="templates"]') ? `form.html?t=${t.id}` : `templates.html#T${t.id}`,
                icon: 'i-file',
                group: '模板'
              });
            }
          });
        }
      } catch (e) { /* offline — skip */ }

      try {
        const res = await fetch('data/courses.json');
        if (res.ok) {
          const data = await res.json();
          data.courses.slice(0, 50).forEach(c => {
            if (!q || (c.title || '').toLowerCase().includes(q) || (c.course_id || '').toLowerCase().includes(q)) {
              items.push({
                label: c.title || c.course_id,
                meta: c.course_id || c.phase || '',
                href: 'training.html',
                icon: 'i-book',
                group: '课程'
              });
            }
          });
        }
      } catch (e) { /* skip */ }

      // Recent
      Recent.list().slice(0, 4).forEach(r => {
        items.push({
          label: r.label,
          meta: '最近',
          href: r.href,
          icon: 'i-clock',
          group: '最近'
        });
      });

      const filtered = q ? items : items.slice(0, 8);
      if (filtered.length === 0) {
        list.innerHTML = '<div class="cmd-empty">没有匹配项</div>';
        return;
      }

      // Group by group
      const groups = {};
      filtered.forEach(it => { (groups[it.group] = groups[it.group] || []).push(it); });
      const html = Object.keys(groups).map(g => `
        <div class="cmd-group-label">${g}</div>
        ${groups[g].map(it => `
          <a class="cmd-item" href="${it.href}">
            <svg class="icon" viewBox="0 0 24 24"><use href="icons/icon.svg#${it.icon}"/></svg>
            <span>${escapeHtml(it.label)}</span>
            ${it.meta ? `<span class="cmd-meta">${escapeHtml(it.meta)}</span>` : ''}
          </a>
        `).join('')}
      `).join('');
      list.innerHTML = html;
      const first = list.querySelector('.cmd-item');
      if (first) first.classList.add('selected');
    }
  };

  // ============ Back to Top ============
  function setupBackToTop() {
    const btn = document.createElement('button');
    btn.className = 'back-to-top';
    btn.setAttribute('aria-label', '返回顶部');
    btn.innerHTML = '<svg class="icon" viewBox="0 0 24 24"><use href="icons/icon.svg#i-arrow-up"/></svg>';
    document.body.appendChild(btn);
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    window.addEventListener('scroll', () => {
      if (window.scrollY > 400) btn.classList.add('visible');
      else btn.classList.remove('visible');
    }, { passive: true });
  }

  // ============ Inject SVG Sprite ============
  function injectSprite() {
    if (document.querySelector('svg[data-icon-sprite]')) return;
    // Use fetch + inline so <use> works reliably across browsers
    fetch('icons/icon.svg')
      .then(r => r.ok ? r.text() : null)
      .then(text => {
        if (!text) return;
        const div = document.createElement('div');
        div.style.display = 'none';
        div.setAttribute('data-icon-sprite', '');
        div.innerHTML = text;
        document.body.insertBefore(div, document.body.firstChild);
      })
      .catch(() => { /* offline — fall back to direct href */ });
  }

  // ============ Extend renderTopNav (from common.js) ============
  // We monkey-patch to add nav-actions cluster.
  if (typeof window.renderTopNav === 'function') {
    const original = window.renderTopNav;
    window.renderTopNav = function (activePage) {
      original.call(this, activePage);
      const nav = document.querySelector('.top-nav');
      if (!nav) return;
      const user = User.get();
      const userChip = user.employeeName
        ? `<div class="user-chip" title="点击退出登录" id="user-chip">
             <span class="avatar">${escapeHtml(User.initials(user.employeeName))}</span>
             <span class="name">${escapeHtml(user.employeeName)}</span>
           </div>`
        : `<div class="user-chip" title="点击设置身份" id="user-chip">
             <span class="avatar">?</span>
             <span class="empty-label">未登录</span>
           </div>`;
      const actions = document.createElement('div');
      actions.className = 'nav-actions';
      actions.innerHTML = `
        <button class="cmd-trigger" id="cmd-trigger" data-i18n-title="action.cmd.open" title="打开命令面板 (Ctrl+K)">
          <svg class="icon" viewBox="0 0 24 24"><use href="icons/icon.svg#i-search"/></svg>
          <span data-i18n="nav.search">搜索</span>
          <kbd>Ctrl K</kbd>
        </button>
        <div class="lang-switch" id="lang-switch" data-i18n-title="lang.switch.title" title="切换语言">
          <button class="lang-btn" data-lang="zh" type="button">中</button>
          <button class="lang-btn" data-lang="vi" type="button">Vi</button>
          <button class="lang-btn" data-lang="en" type="button">EN</button>
        </div>
        <button class="nav-btn" data-theme-toggle data-i18n-title="nav.theme.toggle" title="切换深色模式">
          <svg class="icon icon-moon" viewBox="0 0 24 24"><use href="icons/icon.svg#i-moon"/></svg>
          <svg class="icon icon-sun" viewBox="0 0 24 24"><use href="icons/icon.svg#i-sun"/></svg>
        </button>
        ${userChip}
      `;
      nav.appendChild(actions);
      // Wire actions
      nav.querySelector('[data-theme-toggle]').addEventListener('click', () => Theme.toggle());
      nav.querySelector('#cmd-trigger').addEventListener('click', () => Palette.open());
      // Language switcher
      nav.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => I18n.switch(btn.dataset.lang));
      });
      I18n.updateSwitcherUI();
      // v2.1.1: re-apply i18n to translate newly injected nav-actions
      if (I18n.packs && I18n.packs[I18n.current]) {
        I18n.apply();
      }
      const chip = nav.querySelector('#user-chip');
      if (chip) {
        chip.addEventListener('click', () => {
          if (user.employeeName) {
            if (confirm('退出当前身份？下次填写表单需要重新输入工号和姓名。')) {
              User.clear();
            }
          } else {
            location.href = 'form.html?t=T07';  // any form to trigger emp modal
          }
        });
      }
    };
  }

  // ============ Global Keyboard Shortcuts ============
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K → command palette
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      Palette.open();
      return;
    }
    // Esc → close any open palette/modal
    if (e.key === 'Escape') {
      const palette = document.getElementById('cmd-palette');
      if (palette && palette.classList.contains('open')) {
        Palette.close();
        return;
      }
    }
    // `/` → focus search input (only when not already in an input)
    if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      const search = document.querySelector('.search-input, #tpl-search, #search-input');
      if (search) {
        e.preventDefault();
        search.focus();
      }
    }
    // `g` then `o/t/f` → page navigation (only when not in input)
    if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      if (e.key === 'g') {
        const handler = (ev) => {
          if (ev.key === 'o') location.href = 'index.html';
          else if (ev.key === 't') location.href = 'training.html';
          else if (ev.key === 'f') location.href = 'templates.html';
          document.removeEventListener('keydown', handler);
        };
        document.addEventListener('keydown', handler);
        setTimeout(() => document.removeEventListener('keydown', handler), 1500);
      }
    }
  });

  // ============ i18n (Language) ============
  const I18n = {
    KEY: 'fme_lang',
    DEFAULT: 'zh',
    SUPPORTED: ['zh', 'vi', 'en'],
    packs: {},
    current: null,

    async init() {
      const saved = localStorage.getItem(this.KEY);
      this.current = (saved && this.SUPPORTED.includes(saved)) ? saved : this.DEFAULT;
      await this.loadPack(this.current);
      // Apply once on DOM ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          this.apply();
          // v2.1.1: notify page scripts that the initial language pack is loaded,
          // so they can re-render dynamic content that was rendered before pack load.
          document.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang: this.current } }));
        });
      } else {
        this.apply();
        document.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang: this.current } }));
      }
    },

    async loadPack(lang) {
      if (this.packs[lang]) return;
      try {
        const res = await fetch('data/i18n.json');
        if (res.ok) {
          const data = await res.json();
          if (data[lang]) this.packs[lang] = data[lang];
        }
      } catch (e) { /* offline — fall back to defaults */ }
    },

    t(key, vars) {
      const pack = this.packs[this.current] || {};
      let s = pack[key];
      if (s === undefined) return undefined;  // signal "not found" → caller uses fallback
      if (vars) {
        Object.keys(vars).forEach(k => { s = s.replace('{' + k + '}', String(vars[k])); });
      }
      return s;
    },

    apply() {
      // Swap text content of [data-i18n] elements (skip if no translation found)
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key) {
          const result = this.t(key);
          if (result !== undefined && result !== null) el.textContent = result;
        }
      });
      // Swap placeholders of [data-i18n-ph] elements
      document.querySelectorAll('[data-i18n-ph]').forEach(el => {
        const key = el.getAttribute('data-i18n-ph');
        if (key) {
          const result = this.t(key);
          if (result !== undefined && result !== null) el.placeholder = result;
        }
      });
      // Swap titles of [data-i18n-title] elements
      document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (key) {
          const result = this.t(key);
          if (result !== undefined && result !== null) el.title = result;
        }
      });
      // Document language attribute
      document.documentElement.setAttribute('lang', this.current);
    },

    async switch(lang) {
      if (!this.SUPPORTED.includes(lang) || lang === this.current) return;
      this.current = lang;
      localStorage.setItem(this.KEY, lang);
      await this.loadPack(lang);
      this.apply();
      // v2.1.1: notify page scripts so they can re-render dynamic content
      document.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang } }));
      // Update active state on the switcher
      this.updateSwitcherUI();
    },

    updateSwitcherUI() {
      document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === this.current);
      });
    }
  };
  I18n.init();

  // ============ Breadcrumb helper ============
  window.renderBreadcrumb = function (items) {
    const html = items.map((it, i) => {
      if (i === items.length - 1) {
        return `<span class="crumb-current">${escapeHtml(it.label)}</span>`;
      }
      return `<a href="${it.href}">${escapeHtml(it.label)}</a><span class="crumb-sep">/</span>`;
    }).join('');
    return `<div class="breadcrumb">${html}</div>`;
  };

  // ============ Track page view (recent) ============
  function trackPageView() {
    const page = document.body.getAttribute('data-page') ||
      (location.pathname.endsWith('index.html') || location.pathname.endsWith('/') ? 'overview' :
       location.pathname.endsWith('training.html') ? 'training' :
       location.pathname.endsWith('templates.html') ? 'templates' : null);
    if (!page) return;
    const labels = { overview: '总览', training: '培训', templates: '模板' };
    const hrefs = { overview: 'index.html', training: 'training.html', templates: 'templates.html' };
    Recent.add('page', page, labels[page] || page, hrefs[page] || 'index.html');
  }

  // ============ Boot ============
  document.addEventListener('DOMContentLoaded', () => {
    injectSprite();
    setupBackToTop();
    trackPageView();
    // Pause for progress to be visible
    Progress.done();
  });

  // Export for use by page scripts
  window.App = { Theme, Progress, User, Recent, Favorites, Palette, I18n };
})();
