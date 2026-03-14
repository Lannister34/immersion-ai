@echo off
chcp 65001 >nul
title Immersion AI

echo.
echo  ██╗███╗   ███╗███╗   ███╗███████╗██████╗ ███████╗██╗ ██████╗ ███╗   ██╗
echo  ██║████╗ ████║████╗ ████║██╔════╝██╔══██╗██╔════╝██║██╔═══██╗████╗  ██║
echo  ██║██╔████╔██║██╔████╔██║█████╗  ██████╔╝███████╗██║██║   ██║██╔██╗ ██║
echo  ██║██║╚██╔╝██║██║╚██╔╝██║██╔══╝  ██╔══██╗╚════██║██║██║   ██║██║╚██╗██║
echo  ██║██║ ╚═╝ ██║██║ ╚═╝ ██║███████╗██║  ██║███████║██║╚██████╔╝██║ ╚████║
echo  ╚═╝╚═╝     ╚═╝╚═╝     ╚═╝╚══════╝╚═╝  ╚═╝╚══════╝╚═╝ ╚═════╝ ╚═╝  ╚═══╝
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js not found. Install it from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Install dependencies if needed
if not exist "server\node_modules" (
    echo  [1/3] Installing server dependencies...
    cd server && call npm install --silent && cd ..
) else (
    echo  [1/3] Server dependencies OK
)

if not exist "client\node_modules" (
    echo  [2/3] Installing client dependencies...
    cd client && call npm install --silent && cd ..
) else (
    echo  [2/3] Client dependencies OK
)

:: Check llama-server
if not exist "bin\llama-server.exe" (
    echo  [!] llama-server не найден.
    echo      Запустите setup-llama.bat для автоматической установки.
    echo.
)

:: Build client
echo  [3/3] Building client...
cd client && call npm run build --silent && cd ..
if %errorlevel% neq 0 (
    echo  [ERROR] Client build failed
    pause
    exit /b 1
)

echo.
echo  ✓ Ready! Opening http://localhost:4777
echo  Press Ctrl+C to stop the server.
echo.

:: Open browser after a short delay
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:4777"

:: Start server
cd server && npx tsx src/index.ts
