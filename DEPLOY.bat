@echo off
cd /d "%~dp0"
echo Deployando bitacora-dashboard a Vercel...
npx vercel --prod --yes
pause
