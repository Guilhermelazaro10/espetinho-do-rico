@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando dependencias pela primeira vez...
  call npm install
)
echo.
echo === Agente de impressao - Espetinho do Rico ===
echo (pode minimizar esta janela; feche para parar a impressao)
echo.
node agente.cjs
echo.
echo O agente parou. Aperte uma tecla para fechar.
pause >nul
