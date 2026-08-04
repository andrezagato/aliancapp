@echo off
setlocal
cd /d "%~dp0"

rem Acha o node: primeiro o instalado, depois um node portatil dentro desta pasta.
set NODE=
where node >nul 2>nul
if %errorlevel%==0 set NODE=node
if not defined NODE if exist "node\node.exe" set NODE=node\node.exe
if not defined NODE goto semnode

"%NODE%" ponte.js %*
goto fim

:semnode
echo.
echo ============================================================
echo  Node nao encontrado neste PC.
echo.
echo  Opcao A (sem instalar nada, recomendado):
echo    1. Baixe o ZIP do Node para Windows x64 em nodejs.org
echo       (arquivo "node-vXX.X.X-win-x64.zip")
echo    2. Extraia e renomeie a pasta extraida para   node
echo    3. Coloque essa pasta "node" AQUI, do lado deste arquivo
echo    4. Rode este .cmd de novo
echo.
echo  Opcao B: instale o Node LTS pelo instalador (.msi) do nodejs.org
echo ============================================================
echo.

:fim
echo.
pause
