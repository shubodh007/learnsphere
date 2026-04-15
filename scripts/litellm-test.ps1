param(
  [string]$BaseUrl = "http://localhost:4000",
  [string]$ApiKey = "sk-localproxy",
  [string]$Model = "claude-code",
  [switch]$HealthOnly
)

$uri = "$BaseUrl/v1/chat/completions"
$headers = @{ Authorization = "Bearer $ApiKey" }
$body = @{
  model = $Model
  messages = @(
    @{ role = "user"; content = "Say hello in one sentence." }
  )
} | ConvertTo-Json -Depth 10

try {
  $healthResponse = Invoke-WebRequest -Method Get -Uri "$BaseUrl/health" -Headers $headers -UseBasicParsing -TimeoutSec 30
  Write-Host "LiteLLM health check succeeded with status $($healthResponse.StatusCode)." -ForegroundColor Green

  if ($HealthOnly) {
    return
  }

  $response = Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -ContentType "application/json" -Body $body -TimeoutSec 120
  Write-Host "LiteLLM test request succeeded." -ForegroundColor Green
  $response | ConvertTo-Json -Depth 10
}
catch {
  Write-Error "LiteLLM test request failed: $($_.Exception.Message)"
  if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
    Write-Host $_.ErrorDetails.Message
  }
  exit 1
}
