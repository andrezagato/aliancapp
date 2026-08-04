@echo off
setlocal
set "ATALHO=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Ponte Sirvo.vbs"

echo.
if exist "%ATALHO%" (
  del "%ATALHO%"
  echo  Inicio automatico REMOVIDO.
) else (
  echo  O inicio automatico nao estava instalado.
)

echo  Encerrando a ponte que estiver rodando agora...
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*ponte-oculta.vbs*' -or $_.CommandLine -like '*ponte.js*' } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force } catch {} }"
if exist "%~dp0ponte.lock" del "%~dp0ponte.lock"

echo.
echo  Feito. O roteiro do Sirvo continua funcionando igual — a ponte so
echo  deixa de mandar o tempo e a mensagem pro ProPresenter.
echo.
echo  ATENCAO: se havia mensagem no telao, ela FICA la (a ponte nao esta mais
echo  viva pra tirar). Limpe no ProPresenter se precisar.
echo.
pause
