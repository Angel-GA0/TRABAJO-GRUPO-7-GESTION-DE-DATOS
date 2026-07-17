@echo off
setlocal
cd /d "%~dp0"
set "PY_CMD="
where py >nul 2>nul
if %errorlevel%==0 set "PY_CMD=py -3"
if not defined PY_CMD (
  where python >nul 2>nul
  if %errorlevel%==0 set "PY_CMD=python"
)
if not defined PY_CMD (
  echo No se encontro Python.
  pause
  exit /b 1
)
if not exist ".venv\Scripts\python.exe" %PY_CMD% -m venv .venv
call ".venv\Scripts\activate.bat"
python -m pip install --disable-pip-version-check -q -r backend\requirements.txt
python validar_sistema.py
pause
