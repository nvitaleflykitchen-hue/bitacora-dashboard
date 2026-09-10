param([string]$PythonPath = "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe")
$ErrorActionPreference = 'Stop'
$agentRoot = $PSScriptRoot
$agentScript = Join-Path $agentRoot 'agent.py'
$agentData = Join-Path $agentRoot 'data'
$agentPidFile = Join-Path $agentData 'agent.pid'
if (!(Test-Path -LiteralPath $PythonPath)) { throw 'Indicá la ruta de Python con -PythonPath.' }
if (!(Test-Path -LiteralPath (Join-Path $agentRoot '.env'))) { throw 'Falta configurar .env.' }
New-Item -ItemType Directory -Force -Path $agentData | Out-Null
if (Test-Path -LiteralPath $agentPidFile) {
    $savedAgentPid = [int](Get-Content -LiteralPath $agentPidFile)
    $existingAgent = Get-CimInstance Win32_Process -Filter "ProcessId = $savedAgentPid"
    if ($existingAgent -and $existingAgent.CommandLine.Contains($agentScript)) {
        Write-Output 'El agente ya está en ejecución.'
        exit 0
    }
}
# Sólo variables del proceso hijo; las credenciales permanecen en .env.
$env:OLLAMA_HOST = 'http://localhost:11434'
$env:STATE_DB = Join-Path $agentData 'sync.sqlite'
$env:PYTHONUTF8 = '1'
$agentArguments = '"' + $agentScript + '"'
$agentProcess = Start-Process -FilePath $PythonPath -ArgumentList $agentArguments -WorkingDirectory $agentRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $agentData 'agent.stdout.log') -RedirectStandardError (Join-Path $agentData 'agent.stderr.log')
Set-Content -LiteralPath $agentPidFile -Value $agentProcess.Id
Write-Output "Agente iniciado en segundo plano (PID $($agentProcess.Id))."
