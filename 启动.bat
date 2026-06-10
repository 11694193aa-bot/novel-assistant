@echo off
cd /d "%~dp0"
start "小说助手" cmd /c "npm run serve"
timeout /t 2 /nobreak >nul
start "公网链接" cmd /c "npx localtunnel --port 3000"
echo.
echo   等公网链接窗口显示 your url 即可
echo   手机打开那个链接，密码 219.131.9.74
echo.
pause
