@echo off
setlocal

set "PROJECT_DIR=%~dp0"
start "ERP BOM Demo - Backend" /D "%PROJECT_DIR%backend" cmd /k ".venv\Scripts\python.exe -m uvicorn app.main:app --reload"
start "ERP BOM Demo - Frontend" /D "%PROJECT_DIR%frontend" cmd /k "npm run dev"
timeout /t 5 /nobreak >nul
start "" "http://localhost:5173"

endlocal
exit /b

rem 项目目录定位：使用 %~dp0 获取脚本所在目录，不依赖固定的本机路径。
rem 后端启动：在新窗口中使用 backend\.venv\Scripts\python.exe 运行 FastAPI。
rem 前端启动：在新窗口中以开发模式运行 npm run dev。
rem 浏览器打开：等待服务初始启动后打开 http://localhost:5173。
