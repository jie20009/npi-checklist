/* ============================================================
 * FME-ME Portal v2.0 — Form Engine
 * Renders a form from a JSON schema, validates input, returns data
 * Class names must match css/style.css (form-section, repeatable-row, etc.)
 * ============================================================ */

const FormEngine = {
  schema: null,

  async loadSchema(tid) {
    const res = await fetch('schemas/' + tid + '.json');
    if (!res.ok) throw new Error('Schema not found: ' + tid);
    return await res.json();
  },

  renderForm(schema, container) {
    this.schema = schema;
    container.innerHTML = '';

    // v2.1: i18n helper — uses window.App.I18n if available, fallback to Chinese
    const ti = (key, fallback, vars) => {
      if (window.App && window.App.I18n && typeof window.App.I18n.t === 'function') {
        return window.App.I18n.t(key, vars) || fallback;
      }
      return fallback;
    };

    // Header
    const header = document.createElement('div');
    header.className = 'form-header';
    const profile = JSON.parse(localStorage.getItem('fme_employee_profile') || '{}');
    header.innerHTML = `
      <h1>${escapeHtml(schema.template_name)}
        <span class="draft-badge" id="draft-badge">${ti('form.draft', '草稿')}</span>
      </h1>
      <div class="form-meta">
        <span class="meta-item"><span class="label">${ti('form.meta.template_id', '模板ID:')}</span> <span class="value">${escapeHtml(schema.template_id)}</span></span>
        <span class="meta-item"><span class="label">${ti('form.meta.strategy', '合并策略:')}</span> <span class="value">${this.strategyLabel(schema.merge_strategy)}</span></span>
        <span class="meta-item"><span class="label">${ti('form.meta.filler', '填写人:')}</span> <span class="value">${escapeHtml(profile.employeeName || (window.App && window.App.I18n ? window.App.I18n.t('nav.user.unauth') : '未登录'))}</span></span>
        <span class="meta-item"><span class="label">${ti('form.meta.emp_id', '工号:')}</span> <span class="value">${escapeHtml(profile.employeeId || '—')}</span></span>
        ${schema.template_name_en ? `<span class="meta-item"><span class="label">EN:</span> <span class="value">${escapeHtml(schema.template_name_en)}</span></span>` : ''}
      </div>
      ${schema.notes ? `<div class="form-desc">${escapeHtml(schema.notes)}</div>` : ''}
    `;
    container.appendChild(header);

    // Mode-specific renderer
    // v2.1: if schema.steps is defined, render as multi-step wizard
    if (Array.isArray(schema.steps) && schema.steps.length > 0) {
      this.renderWizard(container);
    } else if (schema.form_mode === 'repeatable') {
      this.renderRepeatable(container);
    } else if (schema.form_mode === 'matrix_self') {
      this.renderMatrixSelf(container);
    } else {
      this.renderSingle(container);
    }

    // Action bar
    this.renderActions(container);

    // v2.1: Evaluate conditional visibility after render
    this.evaluateVisibleIf();
  },

  // v2.1: Conditional visibility — show/hide fields based on other field values
  // Schema: field.visible_if = { field: "状态", op: "eq"|"ne"|"in"|"not_in", values: ["处理中"] }
  evaluateVisibleIf() {
    if (!this.schema) return;
    // For each row scope (single = whole form, repeatable = per row)
    const rowScopes = document.querySelectorAll('.repeatable-rows .repeatable-row');
    const scopes = rowScopes.length > 0 ? Array.from(rowScopes) : [document.querySelector('.form-section')];

    scopes.forEach(scope => {
      // Gather current values for this scope
      const values = {};
      scope.querySelectorAll('[name]').forEach(el => {
        if (el.name) values[el.name] = el.value || '';
      });

      // Evaluate each field with visible_if
      scope.querySelectorAll('.form-field[data-visible-if]').forEach(wrap => {
        const flag = wrap.getAttribute('data-visible-if');
        if (flag !== 'false' && flag !== 'true') return;
        if (!wrap.dataset.visibleIfField) {
          wrap.setAttribute('data-visible-if', 'true');
          return;
        }
        const depField = wrap.dataset.visibleIfField;
        const op = wrap.dataset.visibleIfOp || 'eq';
        const targetValues = JSON.parse(wrap.dataset.visibleIfValues || '[]');
        const current = values[depField] || '';
        let visible = true;
        switch (op) {
          case 'eq':  visible = targetValues.some(v => v === current); break;
          case 'ne':  visible = targetValues.every(v => v !== current); break;
          case 'in':  visible = targetValues.some(v => v === current); break;
          case 'not_in': visible = targetValues.every(v => v !== current); break;
          case 'empty': visible = !current; break;
          case 'not_empty': visible = !!current; break;
          default: visible = true;
        }
        wrap.setAttribute('data-visible-if', visible ? 'true' : 'false');
      });
    });
  },

  renderSingle(container) {
    const ti = this._ti();
    const section = document.createElement('div');
    section.className = 'form-section';
    const h2 = document.createElement('h2');
    h2.textContent = ti('form.fill.content', '填写内容');
    section.appendChild(h2);

    const grid = document.createElement('div');
    grid.className = 'form-grid';
    this.schema.fields.forEach((f, i) => grid.appendChild(this.renderField(f, 0, i)));
    section.appendChild(grid);

    container.appendChild(section);
  },

  renderRepeatable(container) {
    const ti = this._ti();
    const section = document.createElement('div');
    section.className = 'form-section';
    const h2 = document.createElement('h2');
    h2.textContent = ti('form.fill.repeatable', '填写内容（可多行）');
    section.appendChild(h2);

    const hint = document.createElement('div');
    hint.className = 'section-hint';
    hint.textContent = '点击"+ 添加一行"录入多条记录。每行都会进入合并后的 xlsx。';
    section.appendChild(hint);

    // Wrap (grid-column: 1/-1 inside form-grid; but here we're directly in section)
    const wrap = document.createElement('div');
    wrap.className = 'repeatable-wrap';
    wrap.id = 'repeatable-wrap';

    const wrapHeader = document.createElement('div');
    wrapHeader.className = 'repeatable-header';
    const h3 = document.createElement('h3');
    h3.textContent = '记录列表';
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'row-add-btn';
    addBtn.textContent = ti('form.add.row', '+ 添加一行');
    addBtn.addEventListener('click', () => {
      this.addRow(rowsContainer);
      DraftManager.markDirty();
    });
    wrapHeader.appendChild(h3);
    wrapHeader.appendChild(addBtn);
    wrap.appendChild(wrapHeader);

    const rowsContainer = document.createElement('div');
    rowsContainer.className = 'repeatable-rows';
    rowsContainer.id = 'rows-container';
    wrap.appendChild(rowsContainer);

    section.appendChild(wrap);
    container.appendChild(section);

    // Add first row
    this.addRow(rowsContainer);
  },

  addRow(container) {
    if (!this.schema) return;
    const idx = container.children.length;
    const row = document.createElement('div');
    row.className = 'repeatable-row';
    row.dataset.rowIndex = idx;

    const rowIdx = document.createElement('span');
    rowIdx.className = 'row-index';
    rowIdx.textContent = '#' + (idx + 1);
    row.appendChild(rowIdx);

    if (idx > 0) {
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'row-remove';
      delBtn.title = ti('form.row.delete', '删除此行');
      delBtn.textContent = '×';
      delBtn.addEventListener('click', () => {
        row.remove();
        this.renumberRows(container);
        DraftManager.markDirty();
      });
      row.appendChild(delBtn);
    }

    // Determine grid columns from field widths (heuristic: if any field has width=full → cols-1; third → cols-3; else 2)
    const colsClass = this._pickRowColsClass();
    const grid = document.createElement('div');
    grid.className = 'row-grid ' + colsClass;
    this.schema.fields.forEach((f, i) => grid.appendChild(this.renderField(f, idx, i)));
    row.appendChild(grid);

    container.appendChild(row);
  },

  _pickRowColsClass() {
    if (!this.schema) return '';
    // Look at non-full widths to determine grid columns
    const widths = this.schema.fields
      .map(f => f.width || 'half')
      .filter(w => w !== 'full');
    if (widths.length === 0) return 'cols-1';
    if (widths.includes('quarter')) return 'cols-4';
    if (widths.includes('third')) return 'cols-3';
    if (widths.every(w => w === 'full')) return 'cols-1';
    return ''; // default cols-2
  },

  renumberRows(container) {
    Array.from(container.children).forEach((row, idx) => {
      row.dataset.rowIndex = idx;
      const num = row.querySelector('.row-index');
      if (num) num.textContent = '#' + (idx + 1);
      // Renumber field IDs
      row.querySelectorAll('.form-field').forEach((fwrap, fIdx) => {
        const oldId = fwrap.querySelector('input,select,textarea,.formula-field,.readonly-field')?.id || '';
        // IDs are f_<rowIdx>_<fieldIdx>; we leave them — collectData uses rowEl.querySelector([name=...])
      });
    });
  },

  renderMatrixSelf(container) {
    const ti = this._ti();
    const section = document.createElement('div');
    section.className = 'form-section';
    const h2 = document.createElement('h2');
    h2.textContent = ti('form.fill.matrix', '本人技能等级填写');
    section.appendChild(h2);

    const hint = document.createElement('div');
    hint.className = 'section-hint';
    hint.innerHTML = '<strong>本人填写模式</strong>：你只需要填写自己的技能等级。合并程式会按工号自动拼接成全员矩阵。';
    section.appendChild(hint);

    const grid = document.createElement('div');
    grid.className = 'form-grid';
    this.schema.fields.forEach((f, i) => grid.appendChild(this.renderField(f, 0, i)));
    section.appendChild(grid);

    container.appendChild(section);
  },

  renderField(field, rowIdx, fieldIdx) {
    const wrap = document.createElement('div');
    wrap.className = 'form-field';
    if (field.width === 'full') wrap.classList.add('span-full');
    if (field.type === 'formula') wrap.classList.add('formula-field');
    wrap.dataset.fieldName = field.name;
    wrap.dataset.rowIndex = rowIdx;

    // v2.1: Conditional visibility — store visible_if on element
    if (field.visible_if) {
      wrap.dataset.visibleIf = JSON.stringify(field.visible_if);
      wrap.dataset.visibleIfField = field.visible_if.field || '';
      wrap.dataset.visibleIfOp = field.visible_if.op || 'eq';
      wrap.dataset.visibleIfValues = JSON.stringify(field.visible_if.values || []);
      // Initially hidden until evaluated
      wrap.setAttribute('data-visible-if', 'false');
    } else {
      wrap.setAttribute('data-visible-if', 'true');
    }

    const label = document.createElement('label');
    label.htmlFor = `f_${rowIdx}_${fieldIdx}`;
    label.innerHTML = `${escapeHtml(field.label)}${field.required ? '<span class="req">*</span>' : ''}${!field.required ? '<span class="opt">（选填）</span>' : ''}`;
    wrap.appendChild(label);

    let input;
    switch (field.type) {
      case 'text':
        input = document.createElement('input');
        input.type = 'text';
        input.id = `f_${rowIdx}_${fieldIdx}`;
        input.name = field.name;
        if (field.placeholder) input.placeholder = field.placeholder;
        break;

      case 'textarea':
        input = document.createElement('textarea');
        input.id = `f_${rowIdx}_${fieldIdx}`;
        input.name = field.name;
        input.rows = 3;
        if (field.placeholder) input.placeholder = field.placeholder;
        break;

      case 'date':
        input = document.createElement('input');
        input.type = 'date';
        input.id = `f_${rowIdx}_${fieldIdx}`;
        input.name = field.name;
        break;

      case 'number':
        input = document.createElement('input');
        input.type = 'number';
        input.id = `f_${rowIdx}_${fieldIdx}`;
        input.name = field.name;
        if (field.validation) {
          if (field.validation.min !== undefined) input.min = field.validation.min;
          if (field.validation.max !== undefined) input.max = field.validation.max;
        }
        break;

      case 'select':
        input = document.createElement('select');
        input.id = `f_${rowIdx}_${fieldIdx}`;
        input.name = field.name;
        const optEmpty = document.createElement('option');
        optEmpty.value = '';
        optEmpty.textContent = this._ti()('form.select.empty', '— 请选择 —');
        input.appendChild(optEmpty);
        (field.options || []).forEach(opt => {
          const o = document.createElement('option');
          o.value = opt;
          o.textContent = opt;
          input.appendChild(o);
        });
        break;

      case 'formula':
        // Formula rendered as readonly input (CSS: .formula-field > input)
        input = document.createElement('input');
        input.type = 'text';
        input.id = `f_${rowIdx}_${fieldIdx}`;
        input.name = field.name;
        input.readOnly = true;
        input.value = this._ti()('form.formula.placeholder', '（保存后 Excel 自动计算）');
        input.dataset.formula = field.formula || '';
        break;

      case 'readonly':
        input = document.createElement('input');
        input.type = 'text';
        input.id = `f_${rowIdx}_${fieldIdx}`;
        input.name = field.name;
        input.readOnly = true;
        input.value = field.default || '';
        break;

      default:
        input = document.createElement('input');
        input.type = 'text';
        input.id = `f_${rowIdx}_${fieldIdx}`;
        input.name = field.name;
    }

    if (field.default && field.type !== 'readonly' && field.type !== 'formula') {
      input.value = field.default;
    }

    // Auto-save on input
    if (field.type !== 'readonly' && field.type !== 'formula') {
      input.addEventListener('input', () => {
        DraftManager.markDirty();
        this.updateFormulas();
        this.evaluateVisibleIf();
      });
      input.addEventListener('change', () => {
        DraftManager.markDirty();
        this.evaluateVisibleIf();
      });
    }

    wrap.appendChild(input);

    if (field.hint) {
      const hint = document.createElement('div');
      hint.className = 'field-hint';
      hint.textContent = field.hint;
      wrap.appendChild(hint);
    }

    if (field.validation && field.validation.regex) {
      const err = document.createElement('div');
      err.className = 'field-error';
      err.id = `err_${rowIdx}_${fieldIdx}`;
      err.style.display = 'none';
      wrap.appendChild(err);
    }

    return wrap;
  },

  updateFormulas() {
    // Formula preview is just placeholder; actual formula embedded at export time
    // No-op for now (CSS .formula-field shows "保存后 Excel 自动计算")
  },

  renderActions(container) {
    const ti = this._ti();
    const bar = document.createElement('div');
    bar.className = 'form-actions-bar';
    bar.innerHTML = `
      <div class="left-status">
        <span class="save-indicator" id="save-indicator">${ti('form.save.idle', '未编辑')}</span>
      </div>
      <div class="right-actions">
        <button type="button" id="btn-save-draft" class="btn-ghost">${ti('form.draft.save', '保存草稿')}</button>
        <button type="button" id="btn-export" class="btn-ghost">${ti('form.export.xlsx', '导出 XLSX')}</button>
        <button type="button" id="btn-submit" class="btn-primary">${ti('form.submit', '提交到共享盘')}</button>
      </div>
    `;
    container.appendChild(bar);

    bar.querySelector('#btn-save-draft').addEventListener('click', () => {
      DraftManager.saveDraft(true);
    });
    bar.querySelector('#btn-export').addEventListener('click', () => {
      const data = this.collectData();
      if (!data) return;
      XlsxExport.exportAndDownload(this.schema, data);
    });
    bar.querySelector('#btn-submit').addEventListener('click', () => {
      const data = this.collectData();
      if (!data) return;
      SubmitManager.submit(this.schema, data);
    });
  },

  collectData() {
    const rows = [];
    const containers = document.querySelectorAll('.repeatable-rows .repeatable-row');
    const targets = containers.length > 0 ? containers : [document.querySelector('.form-section')];

    targets.forEach((rowEl, rowIdx) => {
      const data = {};
      this.schema.fields.forEach((f, fIdx) => {
        // v2.1: skip hidden conditional fields
        const wrap = rowEl.querySelector(`.form-field[data-field-name="${f.name}"]`);
        if (wrap && wrap.getAttribute('data-visible-if') === 'false') {
          return; // hidden — don't collect
        }
        const el = rowEl.querySelector(`[name="${f.name}"]`) || document.getElementById(`f_${rowIdx}_${fIdx}`);
        if (el) {
          if (f.type === 'formula') {
            data[f.name] = f.formula || '';
          } else if (f.type === 'readonly') {
            data[f.name] = f.default || '';
          } else {
            data[f.name] = el.value || '';
          }
        }
      });
      rows.push(data);
    });

    const errors = this.validate(rows);
    if (errors.length > 0) {
      this.showErrors(errors);
      return null;
    }
    this.clearErrors();
    return rows;
  },

  validate(rows) {
    const ti = this._ti();
    const errors = [];
    rows.forEach((row, rIdx) => {
      this.schema.fields.forEach(f => {
        // v2.1: skip validation for hidden conditional fields
        const wrap = document.querySelectorAll('.form-field[data-field-name="' + f.name + '"]')[rIdx];
        if (wrap && wrap.getAttribute('data-visible-if') === 'false') return;

        if (f.required && !row[f.name]) {
          errors.push({ row: rIdx, field: f.name, message: `${f.label} ${ti('form.error.required', '为必填')}` });
        }
        if (f.validation && f.validation.regex && row[f.name]) {
          const re = new RegExp(f.validation.regex);
          if (!re.test(row[f.name])) {
            errors.push({ row: rIdx, field: f.name, message: f.validation.message || `${f.label} ${ti('form.error.format', '格式错误')}` });
          }
        }
      });
    });
    return errors;
  },

  showErrors(errors) {
    const ti = this._ti();
    this.clearErrors();
    errors.forEach(err => {
      const wraps = document.querySelectorAll(`.form-field[data-field-name="${err.field}"]`);
      const wrap = wraps[err.row] || wraps[0];
      if (wrap) {
        wrap.classList.add('invalid');
        const errEl = wrap.querySelector('.field-error');
        if (errEl) {
          errEl.textContent = err.message;
          errEl.style.display = 'block';
        }
      }
    });
    const msg = ti('form.error.toast', '请检查 {N} 处必填/格式错误', { N: errors.length });
    showToast(msg, 2500);
  },

  clearErrors() {
    document.querySelectorAll('.form-field.invalid').forEach(el => {
      el.classList.remove('invalid');
      const err = el.querySelector('.field-error');
      if (err) err.style.display = 'none';
    });
  },

  // v2.1: i18n helper — uses window.App.I18n if available, fallback to Chinese
  _ti() {
    const self = this;
    return function (key, fallback, vars) {
      if (window.App && window.App.I18n && typeof window.App.I18n.t === 'function') {
        return window.App.I18n.t(key, vars) || fallback;
      }
      return fallback;
    };
  },

  // ============================================================
  // v2.1: Multi-step Wizard
  // Schema: steps: [{ title: "基本信息", fields: ["异常 ID", "日期", "等级"] }, ...]
  // Each step references field names from schema.fields.
  // ============================================================
  renderWizard(container) {
    const ti = this._ti();
    const steps = this.schema.steps;
    this._wizardState = { currentStep: 0, totalSteps: steps.length };

    const section = document.createElement('div');
    section.className = 'form-section wizard-section';

    // Step indicator
    const indicator = document.createElement('div');
    indicator.className = 'wizard-steps-indicator';
    indicator.id = 'wizard-indicator';
    steps.forEach((step, i) => {
      const node = document.createElement('div');
      node.className = 'wizard-step-node' + (i === 0 ? ' active' : '');
      node.dataset.stepIdx = i;
      node.innerHTML = `
        <span class="step-circle">${i + 1}</span>
        <span class="step-label">${escapeHtml(step.title || (ti('wizard.step', '步骤') + ' ' + (i + 1)))}</span>
        <span class="step-connector"></span>
      `;
      indicator.appendChild(node);
    });
    section.appendChild(indicator);

    // Step bodies (only current visible)
    const bodiesWrap = document.createElement('div');
    bodiesWrap.className = 'wizard-bodies';
    bodiesWrap.id = 'wizard-bodies';
    steps.forEach((step, i) => {
      const body = document.createElement('div');
      body.className = 'wizard-body' + (i === 0 ? ' active' : '');
      body.dataset.stepIdx = i;
      const grid = document.createElement('div');
      grid.className = 'form-grid';
      const fieldMap = new Map(this.schema.fields.map(f => [f.name, f]));
      (step.fields || []).forEach((name, fIdx) => {
        const f = fieldMap.get(name);
        if (f) grid.appendChild(this.renderField(f, 0, i * 1000 + fIdx));
      });
      body.appendChild(grid);
      bodiesWrap.appendChild(body);
    });
    section.appendChild(bodiesWrap);

    // Wizard nav buttons
    const nav = document.createElement('div');
    nav.className = 'wizard-nav';
    nav.innerHTML = `
      <button type="button" class="btn-ghost wizard-prev" id="wizard-prev">← ${ti('wizard.prev', '上一步')}</button>
      <span class="wizard-progress-text" id="wizard-progress-text">1 / ${steps.length}</span>
      <button type="button" class="btn-primary wizard-next" id="wizard-next">${ti('wizard.next', '下一步')} →</button>
    `;
    section.appendChild(nav);

    container.appendChild(section);

    // Wire navigation
    nav.querySelector('#wizard-prev').addEventListener('click', () => this._wizardGo(-1));
    nav.querySelector('#wizard-next').addEventListener('click', () => this._wizardGo(1));
    this._wizardUpdateButtons();
  },

  _wizardGo(delta) {
    if (!this._wizardState) return;
    const next = this._wizardState.currentStep + delta;
    if (next < 0) return;
    if (next >= this._wizardState.totalSteps) return; // can't go past last via button (use Submit)
    // If moving forward, validate current step
    if (delta > 0) {
      const ok = this._wizardValidateStep(this._wizardState.currentStep);
      if (!ok) return;
    }
    this._wizardShowStep(next);
  },

  _wizardShowStep(idx) {
    this._wizardState.currentStep = idx;
    document.querySelectorAll('.wizard-body').forEach((b, i) => {
      b.classList.toggle('active', i === idx);
    });
    document.querySelectorAll('.wizard-step-node').forEach((n, i) => {
      n.classList.toggle('active', i === idx);
      n.classList.toggle('done', i < idx);
    });
    const pt = document.getElementById('wizard-progress-text');
    if (pt) pt.textContent = (idx + 1) + ' / ' + this._wizardState.totalSteps;
    this._wizardUpdateButtons();
    this.evaluateVisibleIf();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  _wizardUpdateButtons() {
    const prev = document.getElementById('wizard-prev');
    const next = document.getElementById('wizard-next');
    if (!prev || !next) return;
    const i = this._wizardState.currentStep;
    prev.disabled = (i === 0);
    if (i === this._wizardState.totalSteps - 1) {
      // Last step — turn Next into Submit-like (still uses Action bar's submit btn)
      next.textContent = '✓ ' + this._ti()('wizard.submit', '立即提交');
      next.classList.add('wizard-final');
    } else {
      next.textContent = this._ti()('wizard.next', '下一步') + ' →';
      next.classList.remove('wizard-final');
    }
  },

  _wizardValidateStep(stepIdx) {
    const step = this.schema.steps[stepIdx];
    if (!step || !step.fields) return true;
    // Collect current row data (single mode for wizard)
    const data = {};
    const scope = document.querySelector('.wizard-body[data-step-idx="' + stepIdx + '"]');
    if (!scope) return true;
    step.fields.forEach(name => {
      const el = scope.querySelector('[name="' + name + '"]');
      if (el) data[name] = el.value || '';
    });
    // Validate only fields in this step
    const errors = [];
    this.schema.fields.forEach(f => {
      if (!step.fields.includes(f.name)) return;
      const wrap = scope.querySelector('.form-field[data-field-name="' + f.name + '"]');
      if (wrap && wrap.getAttribute('data-visible-if') === 'false') return;
      if (f.required && !data[f.name]) {
        errors.push({ row: 0, field: f.name, message: f.label + ' ' + this._ti()('form.error.required', '为必填') });
      }
      if (f.validation && f.validation.regex && data[f.name]) {
        const re = new RegExp(f.validation.regex);
        if (!re.test(data[f.name])) {
          errors.push({ row: 0, field: f.name, message: f.validation.message || f.label + ' ' + this._ti()('form.error.format', '格式错误') });
        }
      }
    });
    if (errors.length > 0) {
      this.clearErrors();
      errors.forEach(err => {
        const wrap = scope.querySelector('.form-field[data-field-name="' + err.field + '"]');
        if (wrap) {
          wrap.classList.add('invalid');
          const errEl = wrap.querySelector('.field-error');
          if (errEl) { errEl.textContent = err.message; errEl.style.display = 'block'; }
        }
      });
      showToast(this._ti()('form.error.toast', '请检查 {N} 处必填/格式错误', { N: errors.length }), 2500);
      return false;
    }
    this.clearErrors();
    return true;
  },

  strategyLabel(strategy) {
    return {
      append: '追加',
      matrix: '矩阵',
      dedup: '去重',
    }[strategy] || strategy;
  },
};
