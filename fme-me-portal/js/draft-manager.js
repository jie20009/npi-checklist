/* ============================================================
 * FME-ME Portal v2.0 — Draft Manager
 * Auto-save and restore form drafts to/from localStorage
 * Updates #save-indicator and #draft-badge in form header
 * ============================================================ */

const DraftManager = {
  lastSaveTime: 0,
  dirty: false,
  SAVE_DEBOUNCE_MS: 2000,
  AUTO_SAVE_KEY_PREFIX: 'fme_draft_',
  _timer: null,

  getKey(tid, empId) {
    return this.AUTO_SAVE_KEY_PREFIX + tid + '_' + empId;
  },

  getEmployeeId() {
    const profile = JSON.parse(localStorage.getItem('fme_employee_profile') || '{}');
    return profile.employeeId || 'unknown';
  },

  saveDraft(showToastFlag) {
    if (!FormEngine.schema) return;
    const tid = FormEngine.schema.template_id;
    const empId = this.getEmployeeId();
    const key = this.getKey(tid, empId);
    const data = this._collectRaw();
    if (!data) return;
    const payload = {
      template_id: tid,
      employee_id: empId,
      saved_at: new Date().toISOString(),
      rows: data,
    };
    try {
      localStorage.setItem(key, JSON.stringify(payload));
      this.lastSaveTime = Date.now();
      this.dirty = false;
      this._setIndicator('saved', '已保存 ' + this._formatTime(payload.saved_at));
      if (showToastFlag) {
        showToast('草稿已保存', 1500);
      }
    } catch (e) {
      console.error('Save draft failed:', e);
      this._setIndicator('dirty', '保存失败');
      if (showToastFlag) {
        showToast('草稿保存失败：' + (e.message || '存储空间不足'), 2500);
      }
    }
  },

  markDirty() {
    this.dirty = true;
    this._setIndicator('dirty', '编辑中…');
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.saveDraft(false), this.SAVE_DEBOUNCE_MS);
  },

  loadDraft(tid) {
    const empId = this.getEmployeeId();
    const key = this.getKey(tid, empId);
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.error('Load draft failed:', e);
      return null;
    }
  },

  restoreDraft(tid) {
    const draft = this.loadDraft(tid);
    if (!draft || !draft.rows || draft.rows.length === 0) return false;

    if (FormEngine.schema.form_mode === 'repeatable') {
      const rowsWrap = document.getElementById('rows-container');
      if (rowsWrap) {
        rowsWrap.innerHTML = '';
        // Add as many rows as in draft
        for (let i = 0; i < draft.rows.length; i++) {
          FormEngine.addRow(rowsWrap);
        }
      }
    }

    // Fill values
    draft.rows.forEach((row, rIdx) => {
      FormEngine.schema.fields.forEach((f, fIdx) => {
        const el = document.querySelector(`.form-field[data-field-name="${f.name}"][data-row-index="${rIdx}"] > [name="${f.name}"]`)
                || document.getElementById(`f_${rIdx}_${fIdx}`);
        if (el && row[f.name] !== undefined && f.type !== 'formula' && f.type !== 'readonly') {
          el.value = row[f.name];
        }
      });
    });

    showToast(`已恢复上次草稿 (${this._formatTime(draft.saved_at)})`, 2000);
    this._setIndicator('saved', '已恢复草稿');
    return true;
  },

  clearDraft(tid) {
    const empId = this.getEmployeeId();
    const key = this.getKey(tid, empId);
    localStorage.removeItem(key);
  },

  _collectRaw() {
    const rows = [];
    const containers = document.querySelectorAll('.repeatable-rows .repeatable-row');
    const targets = containers.length > 0 ? containers : [document.querySelector('.form-section')];
    if (targets.length === 0 || !targets[0]) return null;

    targets.forEach((rowEl, rowIdx) => {
      const data = {};
      FormEngine.schema.fields.forEach((f, fIdx) => {
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
    return rows;
  },

  _setIndicator(state, text) {
    const ind = document.getElementById('save-indicator');
    if (ind) {
      ind.classList.remove('saved', 'dirty');
      ind.classList.add(state);
      ind.textContent = text;
    }
    const badge = document.getElementById('draft-badge');
    if (badge) {
      badge.classList.remove('saved', 'dirty');
      badge.classList.add(state);
      badge.textContent = state === 'saved' ? '草稿已存' : '草稿编辑中';
    }
  },

  _formatTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },
};
