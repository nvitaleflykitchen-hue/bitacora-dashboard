@echo off
cd /d "%~dp0"
echo Verificando (lint + tests + build) antes de deployar...
call npm run check
if errorlevel 1 (
    echo.
    echo *** VERIFICACION FALLIDA - NO SE DEPLOYA ***
    echo Corregi los errores de arriba y volve a correr DEPLOY.bat
    pause
    exit /b 1
)
echo Deployando bitacora-dashboard a Vercel...
npx vercel --prod --yes
pause
