@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

if exist "runtime\node.exe" (
  echo Using bundled Node.js runtime
  "runtime\node.exe" dist\index.js %*
  goto :eof
)

set "NODE_PATH="
for /f "tokens=*" %%i in ('where node') do (
  if not defined NODE_PATH set "NODE_PATH=%%i"
)

if not defined NODE_PATH (
  echo [error] Node.js not found in PATH 1>&2
  exit /b 1
)

echo Using system Node.js: %NODE_PATH%
for /f "delims=" %%v in ('"%NODE_PATH%" -v 2^>nul') do set "NODE_VER=%%v"

echo Node.js version: %NODE_VER%
echo [warn] System Node.js detected — behavior may differ

"%NODE_PATH%" dist\index.js %*
endlocal
exit /b %errorlevel%