@echo off
chcp 65001 >nul
title Immersion AI — Установка llama-server
setlocal enabledelayedexpansion

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║   Immersion AI — Установка llama-server          ║
echo  ╚══════════════════════════════════════════════════╝
echo.

:: Check PowerShell availability
where powershell >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ОШИБКА] PowerShell не найден.
    echo  Для работы скрипта необходим PowerShell 5.1+
    pause
    exit /b 1
)

:: GPU selection menu
echo  Выберите сборку llama-server:
echo.
echo    [1] CUDA (NVIDIA GPU)
echo    [2] Vulkan (AMD / Intel GPU)
echo    [3] CPU (без GPU ускорения)
echo.

set /p GPU_CHOICE="  Ваш выбор (1-3): "

if "%GPU_CHOICE%"=="1" (
    set "BACKEND=cuda"
) else if "%GPU_CHOICE%"=="2" (
    set "BACKEND=vulkan"
) else if "%GPU_CHOICE%"=="3" (
    set "BACKEND=cpu"
) else (
    echo.
    echo  [ОШИБКА] Неверный выбор. Введите 1, 2 или 3.
    pause
    exit /b 1
)

echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-llama.ps1" -Backend "%BACKEND%"

echo.
pause
