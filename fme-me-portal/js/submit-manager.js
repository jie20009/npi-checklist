/* ============================================================
 * FME-ME Portal v2.0 — Submit Manager
 * Handles the "submit to network share" flow.
 * Browser cannot write to UNC directly, so the flow is:
 *   1. Export xlsx (downloads to user's Downloads folder)
 *   2. Download a copy_to_share.bat (parameterized)
 *   3. User double-clicks the .bat to copy xlsx to \\share\Submissions\
 * Modal structure matches css/style.css (.submit-modal .modal-card)
 * ============================================================ */

const SubmitManager = {
  SHARE_PATH: '\\\\Pvn-lanfs-01.pvn.corp.pegatron\\bu6$\\GBA-00490358\\FME-ME\\Submissions',

  submit(schema, rows) {
    const filename = XlsxExport.exportAndDownload(schema, rows);
    if (!filename) return;
    this.showSubmitModal(schema, filename, rows.length);
  },

  showSubmitModal(schema, filename, rowCount) {
    const existing = document.querySelector('.submit-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'submit-modal show';
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-card">
        <h2>提交到共享盘</h2>
        <div class="modal-desc">
          浏览器无法直接写入网络共享盘。请按以下步骤完成提交：
        </div>
        <div class="submit-steps">
          <div class="submit-step done" id="step-export">
            <span class="step-icon">✓</span>
            <div class="step-content">
              <div class="step-title">XLSX 已生成并下载</div>
              <div class="step-desc">
                文件名: <code>${escapeHtml(filename)}</code><br>
                行数: ${rowCount} 条记录
              </div>
            </div>
          </div>
          <div class="submit-step" id="step-bat">
            <span class="step-icon">2</span>
            <div class="step-content">
              <div class="step-title">下载复制脚本</div>
              <div class="step-desc">双击 .bat 文件将 xlsx 从下载文件夹复制到共享盘。</div>
              <button type="button" class="step-action" id="btn-dl-bat">下载 copy_to_share.bat</button>
            </div>
          </div>
          <div class="submit-step" id="step-path">
            <span class="step-icon">i</span>
            <div class="step-content">
              <div class="step-title">提交目标路径</div>
              <div class="step-desc">
                <code>${escapeHtml(this.SHARE_PATH)}</code><br>
                如路径不通请联系 IT 或主管开通共享盘访问权限。
              </div>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-close" id="btn-submit-done">完成</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('.modal-backdrop').addEventListener('click', () => modal.remove());
    modal.querySelector('#btn-submit-done').addEventListener('click', () => modal.remove());
    modal.querySelector('#btn-dl-bat').addEventListener('click', (e) => {
      this.downloadBat(schema);
      const step = modal.querySelector('#step-bat');
      if (step) step.classList.add('done');
      e.target.style.display = 'none';
      const stepDesc = step.querySelector('.step-desc');
      if (stepDesc) stepDesc.innerHTML = '已下载 .bat 脚本。请到下载文件夹双击执行。';
    });
  },

  downloadBat(schema) {
    const batContent = this._buildBatContent(schema);
    const blob = new Blob([batContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `copy_to_share_${schema.template_id}.bat`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    showToast('已下载 .bat 脚本，请双击执行', 2500);
  },

  _buildBatContent(schema) {
    const tid = schema.template_id;
    return `@echo off
chcp 65001 >nul
REM ============================================================
REM FME-ME Portal v2.0 - Auto-generated copy script
REM Copies ${tid}_*.xlsx submissions from Downloads to network share
REM Generated: ${new Date().toISOString()}
REM ============================================================

setlocal enabledelayedexpansion

set "SRC=%USERPROFILE%\\Downloads"
set "DST=${this.SHARE_PATH}"

echo.
echo FME-ME 提交脚本 - ${schema.template_name}
echo.
echo 源目录: %SRC%
echo 目标目录: %DST%
echo.

REM Check if destination exists
if not exist "%DST%\\" (
  echo [错误] 共享盘路径不存在或无权限访问:
  echo   %DST%
  echo.
  echo 请确认:
  echo   1. 已连接公司网络 (PVN 内网或 VPN)
  echo   2. 有共享盘读写权限
  echo   3. 路径未变动
  echo.
  pause
  exit /b 1
)

REM Count and copy
set /a count=0
for %%f in ("%SRC%\\${tid}_*.xlsx") do (
  set /a count+=1
  copy "%%f" "%DST%\\%%~nxf" /Y
  if errorlevel 1 (
    echo [失败] %%~nxf
  ) else (
    echo [成功] %%~nxf
  )
)

echo.
if !count! equ 0 (
  echo [警告] 下载文件夹中没有找到 ${tid}_*.xlsx 文件
  echo 请先在 portal 上点击"导出 XLSX"或"提交到共享盘"
) else (
  echo 已复制 !count! 个文件到共享盘
)
echo.
echo 你可以在以下位置查看已提交的文件:
echo   %DST%
echo.
pause
endlocal
`;
  },
};
