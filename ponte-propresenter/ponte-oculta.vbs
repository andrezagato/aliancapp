' PONTE SIRVO — lanchadeira invisível + supervisor, sem instalar nada.
'
' Duas razões pra existir:
'   1. Roda o node com janela ESCONDIDA (o 0 no Run). Numa sala de controle,
'      janela de console é coisa que alguém fecha sem querer no meio do culto.
'   2. Se o processo cair por algo inesperado, ela sobe de novo em 15s.
'      Mas NÃO insiste quando a saída foi deliberada:
'        0 = encerrada de propósito   3 = config/senha errada   4 = já tem uma rodando
'      Reiniciar nesses casos só encheria o log de repetição inútil.
'
' Não requer administrador, não cria serviço, não deixa rastro além do atalho.

Dim shell, fso, pasta, node, comando, codigo
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
pasta = fso.GetParentFolderName(WScript.ScriptFullName)

' Node instalado no PATH, ou a versão portátil dentro da pasta.
If fso.FileExists(pasta & "\node\node.exe") Then
  node = """" & pasta & "\node\node.exe"""
Else
  node = "node"
End If

comando = node & " """ & pasta & "\ponte.js"""

Do
  ' 0 = janela escondida; True = espera terminar pra ler o código de saída.
  codigo = shell.Run(comando, 0, True)
  If codigo = 0 Or codigo = 3 Or codigo = 4 Then
    Exit Do
  End If
  WScript.Sleep 15000
Loop
