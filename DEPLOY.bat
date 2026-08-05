@echo off
cd /d "%~dp0"
echo Verificando rama, sincronizacion, lint, tests y build antes de deployar...
call npm run deploy:prod
if errorlevel 1 (
    echo.
    echo *** VERIFICACION FALLIDA - NO SE DEPLOYA ***
    echo Corregi los errores de arriba y volve a correr DEPLOY.bat
    pause
    exit /b 1
)
pause
