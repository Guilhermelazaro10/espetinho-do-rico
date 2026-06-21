' Inicia o agente de impressao SEM abrir janela.
' Usado pelo atalho da pasta de Inicializacao do Windows.
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
sh.Run "node agente.cjs", 0, False
