@echo off
setlocal
cd /d "%~dp0"

set "NODE_EXE="

rem 1) Prefer the Node bundled with WorkBuddy (works even when WorkBuddy UI is closed).
for /d %%D in ("%USERPROFILE%\.workbuddy\binaries\node\versions\*") do (
  if exist "%%D\node.exe" set "NODE_EXE=%%D\node.exe"
)

rem 2) Fall back to a globally installed node.
if not defined NODE_EXE (
  for /f "delims=" %%I in ('where node 2^>nul') do (
    if not defined NODE_EXE set "NODE_EXE=%%I"
  )
)

if not defined NODE_EXE (
  echo ERROR: Node.js not found. Install Node.js or start WorkBuddy once.
  pause
  exit /b 1
)

echo Using Node: %NODE_EXE%
echo Starting MGC local server...
start "MGC Website Server" /min cmd /c ""%NODE_EXE%" "%CD%\server.js" > "%CD%\server-local.log" 2>&1"

rem Wait until port 8000 is really listening before opening the browser.
set /a TRIES=0
:WAIT_PORT
powershell -NoProfile -Command "try { $c = New-Object Net.Sockets.TcpClient('127.0.0.1', 8000); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
if %ERRORLEVEL%==0 goto READY
set /a TRIES+=1
if %TRIES% GEQ 20 goto FAILED
timeout /t 1 /nobreak >nul
goto WAIT_PORT

:READY
echo Server is ready. Opening browser...
start "" "http://localhost:8000/#market-agent"
echo.
echo Keep the "MGC Website Server" window open while testing.
echo Close that window to stop the local service.
timeout /t 4 /nobreak >nul
exit /b 0

:FAILED
echo.
echo ERROR: local server did not start within 20 seconds.
if exist "%CD%\server-local.log" (
  echo ---- server-local.log ----
  type "%CD%\server-local.log"
  echo --------------------------
)
pause
exit /b 1
