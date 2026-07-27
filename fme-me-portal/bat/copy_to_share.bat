@echo off
chcp 65001 >nul
REM ============================================================
REM FME-ME Portal v2.0 - Generic copy-to-share script
REM Copies ALL T??_*.xlsx submissions from Downloads to network share
REM
REM Usage:
REM   1. Double-click this file, OR
REM   2. Run from command line: copy_to_share.bat
REM
REM You can also pass a specific template ID as the first argument:
REM   copy_to_share.bat T07
REM   -> only copies T07_*.xlsx files
REM
REM Generated: 2026-07-27
REM ============================================================

setlocal enabledelayedexpansion

set "SRC=%USERPROFILE%\Downloads"
set "DST=\\Pvn-lanfs-01.pvn.corp.pegatron\bu6$\GBA-00490358\FME-ME\Submissions"

REM Optional template filter from arg 1
set "TID_FILTER=%1"
if "%TID_FILTER%"=="" (
  set "GLOB=T??_*.xlsx"
  set "FILTER_DESC=all templates"
) else (
  set "GLOB=%TID_FILTER%_*.xlsx"
  set "FILTER_DESC=%TID_FILTER% only"
)

echo.
echo ============================================================
echo  FME-ME Portal - Submit to Network Share
echo ============================================================
echo.
echo  Filter: !FILTER_DESC!
echo  Source: %SRC%
echo  Target: %DST%
echo.

REM Check if destination exists
if not exist "%DST%\\" (
  echo [ERROR] Network share path not reachable:
  echo   %DST%
  echo.
  echo Please verify:
  echo   1. Connected to corporate network (PVN LAN or VPN)
  echo   2. Have read/write permission to this share
  echo   3. Path has not changed
  echo.
  pause
  exit /b 1
)

REM Count and copy
set /a count=0
set /a failed=0
for %%f in ("%SRC%\!GLOB!") do (
  set /a count+=1
  copy "%%f" "%DST%\%%~nxf" /Y >nul 2>&1
  if errorlevel 1 (
    echo [FAILED]  %%~nxf
    set /a failed+=1
  ) else (
    echo [OK]      %%~nxf
  )
)

echo.
echo ============================================================
if !count! equ 0 (
  echo [WARNING] No matching xlsx files found in Downloads
  echo   Pattern: !GLOB!
  echo.
  echo Please first click "Export XLSX" or "Submit to Share" in the portal.
) else (
  echo Copied !count! file^(s^) to share
  if !failed! gtr 0 (
    echo [WARNING] !failed! file^(s^) failed - check permissions or disk space
  )
)
echo ============================================================
echo.
echo You can review submitted files at:
echo   %DST%
echo.
pause
endlocal
