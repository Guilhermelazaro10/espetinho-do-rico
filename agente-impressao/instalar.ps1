$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host '====================================================='
Write-Host '  Agente de impressao - Espetinho do Rico'
Write-Host '  Configurando para iniciar sozinho com o Windows'
Write-Host '====================================================='
Write-Host ''

if (-not (Test-Path 'node_modules')) {
  Write-Host 'Instalando dependencias (so na primeira vez)...'
  npm install
}

# cria um atalho na pasta de Inicializacao apontando para o lancador oculto
$startup = [Environment]::GetFolderPath('Startup')
$atalho  = Join-Path $startup 'Espetinho Impressao.lnk'
$vbs     = Join-Path $PSScriptRoot 'iniciar-oculto.vbs'

$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($atalho)
$sc.TargetPath       = 'wscript.exe'
$sc.Arguments        = '"' + $vbs + '"'
$sc.WorkingDirectory = $PSScriptRoot
$sc.Save()

Write-Host ''
Write-Host 'OK! O agente vai subir sozinho toda vez que o PC ligar.'
Write-Host 'Iniciando agora em segundo plano...'
Start-Process 'wscript.exe' -ArgumentList ('"' + $vbs + '"')
Write-Host ''
Write-Host 'Pronto. Pode fechar esta janela.'
