@echo off
setlocal
title 长春地铁文旅 Demo
echo.
echo  ====== 长春地铁文旅 Demo 一键启动 ======
echo.

cd /d "%~dp0changchun-metro-demo"
if not exist "package.json" (
  echo  [错误] 未找到 changchun-metro-demo 目录，请勿单独移动本脚本。
  goto FAIL
)

where npm >nul 2>nul
if errorlevel 1 (
  echo  [错误] 未检测到 Node.js / npm，请先安装：https://nodejs.org
  goto FAIL
)

if not exist "node_modules" (
  echo  [首次运行] 正在安装依赖，请稍候（约 1 分钟）...
  call npm install
  if errorlevel 1 (
    echo  [错误] 依赖安装失败，请检查网络后重试。
    goto FAIL
  )
)

echo  [启动] 开发服务器 http://localhost:5173 （关闭本窗口即停止服务）
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 4; Start-Process 'http://localhost:5173/'"
call npm run dev

echo.
echo  [已退出] 开发服务器已停止。
goto END

:FAIL
echo.

:END
echo  按任意键关闭窗口...
pause >nul
endlocal
