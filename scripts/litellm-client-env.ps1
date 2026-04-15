param(
  [int]$Port = 4000,
  [string]$ProxyKey = "sk-localproxy"
)

$env:ANTHROPIC_BASE_URL = "http://localhost:$Port"
$env:ANTHROPIC_API_KEY = $ProxyKey

Write-Host "Set for current shell:" -ForegroundColor Green
Write-Host "  ANTHROPIC_BASE_URL=$env:ANTHROPIC_BASE_URL"
Write-Host "  ANTHROPIC_API_KEY=$env:ANTHROPIC_API_KEY"
