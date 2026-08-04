@echo off
setlocal
cd /d "%~dp0"
echo.
powershell -NoProfile -Command "$e = $null; if (Test-Path 'ponte-estado.json') { try { $e = Get-Content 'ponte-estado.json' -Raw | ConvertFrom-Json } catch {} }; if ($e -and $e.visto) { $s = [int]((Get-Date) - [datetime]$e.visto).TotalSeconds; if ($s -lt 90) { Write-Host ('  PONTE VIVA - ultimo batimento ha ' + $s + 's') -ForegroundColor Green } else { Write-Host ('  PONTE PARADA? ultimo batimento ha ' + $s + 's, em ' + $e.visto) -ForegroundColor Red } } else { Write-Host '  Sem batimento registrado - a ponte nunca rodou nesta pasta, ou e versao antiga.' -ForegroundColor Yellow }; if ($e -and $e.noTelao) { Write-Host ('  MENSAGEM NO TELAO agora (id ' + $e.msgId + ')') -ForegroundColor Yellow }"
echo.
echo  --- log ao vivo (Ctrl+C pra sair; isso NAO desliga a ponte) ---
echo.
powershell -NoProfile -Command "if (Test-Path 'ponte.log') { Get-Content 'ponte.log' -Tail 25 -Wait } else { Write-Host '  ponte.log ainda nao existe.' }"
