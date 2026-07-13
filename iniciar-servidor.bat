@echo off
setlocal

cd /d "%~dp0server"
if errorlevel 1 (
  echo No se encontro la carpeta server.
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js no esta instalado o no esta en el PATH.
  echo.
  echo Instalalo desde: https://nodejs.org/  ^(version LTS^)
  echo O en PowerShell como administrador:
  echo   winget install OpenJS.NodeJS.LTS
  echo.
  pause
  exit /b 1
)

if not exist ".env" (
  echo Falta server\.env
  echo Copia server\.env.example a server\.env y completa SESSION_SECRET y DEMO_PORTAL_PASSWORD.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Instalando dependencias ^(npm ci^)...
  call npm ci
  if errorlevel 1 (
    echo Fallo npm ci
    pause
    exit /b 1
  )
)

echo.
echo Servidor en http://localhost:3000
echo Login: http://localhost:3000/login.html  ^(password: numia2026^)
echo App cliente: http://localhost:3000/app-cliente.html
echo.
echo Ctrl+C para detener
echo.

call npm start
