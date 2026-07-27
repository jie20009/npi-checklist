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

    // Header
    const header = document.createElement('div');
    header.className = 'form-header';
    const profile = JSON.parse(localStorage.getItem('fme_employee_profile') || '{}');
    header.innerHTML = `
      <h1>${escapeHtml(schema.template_name)}
        <span class="draft-badge" id="draft-badge">草稿</span>
      </h1>
      <div class="form-meta">
        <span class="meta-item"><span class="label">模板ID:</span> <span class="value">${escapeHtml(schema.template_id)}</span></span>
        <span class="meta-item"><span class="label">合并策略:</span> <span class="value">${this.strategyLabel(schema.merge_strategy)}</span></span>
        <span class="meta-item"><span class="label">填写人:</span> <span class="value">${escapeHtml(profile.employeeName || '未登录')}</span></span>
        <span class="meta-item"><span class="label">工号:</span> <span class="value">${escapeHtml(profile.employeeId || '—')}</span></span>
        ${schema.template_name_en ? `<span class="meta-item"><span class="label">EN:</span> <span class="value">${escapeHtml(schema.template_name_en)}</span></span>` : ''}
      </div>
      ${schema.notes ? `<div class="form-desc">${escapeHtml(schema.notes)}</div>` : ''}
    `;
    container.appendChild(header);

    // Mode-specific renderer
    if (schema.form_mode === 'repeatable') {
      this.renderRepeatable(container);
    } else if (schema.form_mode === 'matrix_self') {
      this.renderMatrixSelf(container);
    } else {
      this.renderSingle(container);
    }

    // Action bar
    this.renderActions(container);
  },

  renderSingle(container) {
    const section = document.createElement('div');
    section.className = 'form-section';
    const h2 = document.createElement('h2');
    h2.textContent = '填写内容';
    section.appendChild(h2);

    const grid = document.createElement('div');
    grid.className = 'form-grid';
    this.schema.fields.forEach((f, i) => grid.appendChild(this.renderField(f, 0, i)));
    section.appendChild(grid);

    container.appendChild(section);
  },

  renderRepeatable(container) {
    const section = document.createElement('div');
    section.className = 'form-section';
    const h2 = document.createElement('h2');
    h2.textContent = '填写内容（可多行）';
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
    addBtn.textContent = '+ 添加一行';
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
      delBtn.title = '删除此行';
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
    const section = document.createElement('div');
    section.className = 'form-section';
    const h2 = document.createElement('h2');
    h2.textContent = '本人技能等级填写';
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
        optEmpty.textContent = '— 请选择 —';
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
        input.value = '（保存后 Excel 自动计算）';
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
      });
      input.addEventListener('change', () => {
        DraftManager.markDirty();
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
    const bar = document.createElement('div');
    bar.className = 'form-actions-bar';
    bar.innerHTML = `
      <div class="left-status">
        <span class="save-indicator" id="save-indicator">未编辑</span>
      </div>
      <div class="right-actions">
        <button type="button" id="btn-save-draft" class="btn-ghost">保存草稿</button>
        <button type="button" id="btn-export" class="btn-ghost">导出 XLSX</button>
        <button type="button" id="btn-submit" class="btn-primary">提交到共享盘</button>
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
    const errors = [];
    rows.forEach((row, rIdx) => {
      this.schema.fields.forEach(f => {
        if (f.required && !row[f.name]) {
          errors.push({ row: rIdx, field: f.name, message: `${f.label} 为必填` });
        }
        if (f.validation && f.validation.regex && row[f.name]) {
          const re = new RegExp(f.validation.regex);
          if (!re.test(row[f.name])) {
            errors.push({ row: rIdx, field: f.name, message: f.validation.message || `${f.label} 格式错误` });
          }
        }
      });
    });
    return errors;
  },

  showErrors(errors) {
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
    showToast('请检查 ' + errors.length + ' 处必填/格式错误', 2500);
  },

  clearErrors() {
    document.querySelectorAll('.form-field.invalid').forEach(el => {
      el.classList.remove('invalid');
      const err = el.querySelector('.field-error');
      if (err) err.style.display = 'none';
    });
  },

  strategyLabel(strategy) {
    return {
      append: '追加',
      matrix: '矩阵',
      dedup: '去重',
    }[strategy] || strategy;
  },
};
