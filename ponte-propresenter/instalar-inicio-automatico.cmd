@echo off
setlocal
set "INICIO=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "ATALHO=%INICIO%\Ponte Sirvo.vbs"

echo.
echo  Instalando o inicio automatico da ponte...
echo.

if not exist "%~dp0config.json" (
  echo  PARE: nao existe config.json nesta pasta.
  echo  Preencha o config antes de instalar, senao a ponte sobe e morre calada.
  echo.
  pause
  exit /b 1
)

rem Um lancador de 2 linhas na pasta de Inicializacao do SEU usuario. Sem
rem administrador, sem servico, sem Agendador de Tarefas: um arquivo, que o
rem desinstalador apaga. Ele chama o ponte-oculta.vbs sem esperar e sai.
> "%ATALHO%" echo Set s = CreateObject("WScript.Shell")
>>"%ATALHO%" echo s.Run "wscript.exe ""%~dp0ponte-oculta.vbs""", 0, False

if not exist "%ATALHO%" (
  echo  FALHOU: nao consegui escrever em
  echo  %INICIO%
  echo.
  pause
  exit /b 1
)

echo  Pronto. A partir do proximo logon deste usuario a ponte sobe sozinha,
echo  escondida, e se recupera se cair.
echo.
echo  Ligando agora tambem, pra nao ter que reiniciar...
start "" wscript.exe "%~dp0ponte-oculta.vbs"

echo.
echo  Para ver se esta viva:      ver-log.cmd
echo  Para desligar de vez:       desinstalar-inicio-automatico.cmd
echo.
pause
