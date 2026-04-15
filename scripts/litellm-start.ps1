param(
  [int]$Port = 4000,
  [string]$ConfigPath = (Join-Path $PSScriptRoot "..\config.yaml"),
  [switch]$Debug
)

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$workspaceRoot = Split-Path -Parent $repoRoot

function Get-EnvValueFromFile {
  param(
    [string]$FilePath,
    [string]$VarName
  )

  if (-not (Test-Path $FilePath)) {
    return $null
  }

  $pattern = "^\s*$([regex]::Escape($VarName))\s*=\s*(.+?)\s*$"
  foreach ($line in Get-Content -Path $FilePath) {
    if ($line -match "^\s*#") {
      continue
    }

    if ($line -match $pattern) {
      $raw = $Matches[1].Trim()

      if (
        ($raw.StartsWith('"') -and $raw.EndsWith('"')) -or
        ($raw.StartsWith("'") -and $raw.EndsWith("'"))
      ) {
        $raw = $raw.Substring(1, $raw.Length - 2)
      }

      return $raw.Trim()
    }
  }

  return $null
}

$resolvedConfig = Resolve-Path $ConfigPath -ErrorAction SilentlyContinue
if (-not $resolvedConfig) {
  Write-Error "LiteLLM config not found at: $ConfigPath"
  exit 1
}

if (-not $env:OPENROUTER_API_KEY) {
  $envFiles = @(
    (Join-Path $repoRoot ".env"),
    (Join-Path $repoRoot ".env.example")
  )

  foreach ($envFile in $envFiles) {
    $candidate = Get-EnvValueFromFile -FilePath $envFile -VarName "OPENROUTER_API_KEY"
    if ($candidate) {
      $env:OPENROUTER_API_KEY = $candidate
      Write-Host "Loaded OPENROUTER_API_KEY from $envFile" -ForegroundColor Green
      break
    }
  }
}

if (-not $env:OPENROUTER_API_KEY) {
  Write-Error "OPENROUTER_API_KEY is not set in this shell."
  Write-Host "Set it first or put it in .env/.env.example:" -ForegroundColor Yellow
  Write-Host '  OPENROUTER_API_KEY=sk-or-v1-your-key'
  exit 1
}

if ($env:OPENROUTER_API_KEY -notmatch "^sk-or-v1-") {
  Write-Warning "OPENROUTER_API_KEY does not start with 'sk-or-v1-'."
}

$env:ANTHROPIC_BASE_URL = "http://localhost:$Port"
if (-not $env:ANTHROPIC_API_KEY) {
  $env:ANTHROPIC_API_KEY = "sk-localproxy"
}

# Avoid startup stalls caused by fetching remote model-cost map over SSL.
if (-not $env:LITELLM_LOCAL_MODEL_COST_MAP) {
  $env:LITELLM_LOCAL_MODEL_COST_MAP = "True"
}

$pythonCandidates = @(
  (Join-Path $repoRoot ".litellm311b-venv\Scripts\python.exe"),
  (Join-Path $repoRoot ".litellm311-venv\Scripts\python.exe"),
  (Join-Path $repoRoot ".litellm-venv\Scripts\python.exe"),
  (Join-Path $workspaceRoot ".venv\Scripts\python.exe")
)

$pythonPath = $pythonCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $pythonPath) {
  $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
  if ($pythonCmd) {
    $pythonPath = $pythonCmd.Source
  }
}

if (-not $pythonPath) {
  Write-Error "Could not find a Python runtime for LiteLLM."
  Write-Host "Expected one of:" -ForegroundColor Yellow
  $pythonCandidates | ForEach-Object { Write-Host "  $_" }
  exit 1
}

Write-Host "Starting LiteLLM via $pythonPath on http://localhost:$Port" -ForegroundColor Cyan
Write-Host "Using config: $($resolvedConfig.Path)" -ForegroundColor Cyan

$args = @(
  "-m",
  "litellm.proxy.proxy_cli",
  "--config",
  $resolvedConfig.Path,
  "--port",
  "$Port"
)

if ($Debug) {
  $args += "--debug"
}

& $pythonPath @args
exit $LASTEXITCODE
