@echo off
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Espetinho Impressao.lnk" 2>nul
echo Inicio automatico removido.
echo (Se o agente estiver rodando, finalize "wscript.exe" no Gerenciador de Tarefas.)
pause
