/* ============================================================
 * FME-ME Portal v2.0 — XLSX Export
 * Uses SheetJS (xlsx.full.min.js, loaded from lib/) to generate xlsx
 * ============================================================ */

const XlsxExport = {
  /**
   * Export form data to xlsx and trigger download.
   * Output: 2 sheets — sheet 1 = data, sheet 2 = _meta
   * Filename: {TID}_{工号}_{YYYYMMDD}_{HHmmss}.xlsx
   */
  exportAndDownload(schema, rows) {
    if (typeof XLSX === 'undefined') {
      showToast('XLSX 库未加载，请检查 lib/xlsx.full.min.js', 3000);
      return null;
    }

    // Build worksheet from rows
    const headers = schema.fields.map(f => f.name);
    const aoa = [headers];
    rows.forEach(row => {
      const rowArr = schema.fields.map(f => this._cellValue(row[f.name], f));
      aoa.push(rowArr);
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Set column widths
    ws['!cols'] = schema.fields.map(f => ({ wch: this._colWidth(f) }));

    // Build meta sheet
    const profile = JSON.parse(localStorage.getItem('fme_employee_profile') || '{}');
    const now = new Date();
    const metaAoa = [
      ['key', 'value'],
      ['template_id', schema.template_id],
      ['template_name', schema.template_name],
      ['submitter_id', profile.employeeId || 'unknown'],
      ['submitter_name', profile.employeeName || ''],
      ['submit_time', now.toISOString()],
      ['portal_version', '2.0'],
      ['merge_strategy', schema.merge_strategy],
      ['primary_key', schema.primary_key || ''],
      ['row_count', String(rows.length)],
    ];
    const metaWs = XLSX.utils.aoa_to_sheet(metaAoa);
    metaWs['!cols'] = [{ wch: 20 }, { wch: 40 }];

    // Build workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, schema.sheet_name || '数据');
    XLSX.utils.book_append_sheet(wb, metaWs, '_meta');

    // Filename
    const ts = this._formatTimestamp(now);
    const empId = (profile.employeeId || 'unknown').replace(/[^A-Za-z0-9]/g, '');
    const filename = `${schema.template_id}_${empId}_${ts}.xlsx`;

    // Generate blob
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    // Trigger download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);

    showToast(`已导出 ${filename}`, 2500);
    return filename;
  },

  _cellValue(value, field) {
    if (field.type === 'formula' && field.formula) {
      // Embed formula — Excel will compute on open
      // SheetJS formula syntax: starts with '='
      // Replace {row} with actual row number (will be patched at merge time)
      return { f: field.formula.replace(/\{row\}/g, '2') };
    }
    if (field.type === 'number' && value !== '' && value !== null) {
      const n = parseFloat(value);
      return isNaN(n) ? value : n;
    }
    if (field.type === 'date' && value) {
      // Keep ISO format string
      return value;
    }
    return value || '';
  },

  _colWidth(field) {
    if (field.type === 'textarea') return 40;
    if (field.type === 'date') return 14;
    if (field.type === 'select') return 14;
    if (field.name.includes('ID') || field.name.includes('编号')) return 22;
    return 16;
  },

  _formatTimestamp(d) {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  },
};
