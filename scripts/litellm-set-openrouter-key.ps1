param(
  [switch]$CurrentShellOnly
)

$key = Read-Host -Prompt "Enter OPENROUTER_API_KEY (input hidden)" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($key)

try {
  $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
}
finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}

if ([string]::IsNullOrWhiteSpace($plainKey)) {
  Write-Error "No key entered."
  exit 1
}

if (-not $plainKey.StartsWith("sk-or-v1-")) {
  Write-Warning "Key does not start with 'sk-or-v1-'. Continue only if intentional."
}

$env:OPENROUTER_API_KEY = $plainKey

if (-not $CurrentShellOnly) {
  [Environment]::SetEnvironmentVariable("OPENROUTER_API_KEY", $plainKey, "User")
  Write-Host "OPENROUTER_API_KEY set for current shell and persisted for your user account." -ForegroundColor Green
} else {
  Write-Host "OPENROUTER_API_KEY set for current shell only." -ForegroundColor Green
}

Write-Host "Open a new terminal after persistence to pick up the user env var." -ForegroundColor Yellow
