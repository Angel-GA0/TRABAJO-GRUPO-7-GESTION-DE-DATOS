@echo off
setlocal
cd /d "%~dp0"
title Sistema de matricula escolar en Junin

set "PY_CMD="
where py >nul 2>nul
if %errorlevel%==0 set "PY_CMD=py -3"
if not defined PY_CMD (
  where python >nul 2>nul
  if %errorlevel%==0 set "PY_CMD=python"
)
if not defined PY_CMD (
  echo.
  echo No se encontro Python en el equipo.
  echo Instale Python 3.11 o superior y marque "Add Python to PATH".
  pause
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo Creando entorno de ejecucion...
  %PY_CMD% -m venv .venv
  if errorlevel 1 goto :error
)

call ".venv\Scripts\activate.bat"
python -m pip install --disable-pip-version-check -q -r backend\requirements.txt
if errorlevel 1 goto :error

start "" /b python abrir_navegador.py
python -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000
exit /b 0

:error
echo.
echo No se pudo iniciar el sistema. Revise el mensaje anterior.
pause
exit /b 1
