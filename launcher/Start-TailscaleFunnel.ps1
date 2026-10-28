param([int]$Port = 8788, [switch]$WriteFixedRelay, [switch]$Reset)

$ErrorActionPreference = 'Stop'
$ts = Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe'
if (-not (Test-Path -LiteralPath $ts)) {
    throw "Tailscale is not installed at $ts"
}

if ($Reset) {
    & $ts funnel reset
    if ($LASTEXITCODE -ne 0) { throw "Tailscale Funnel reset failed." }
    Write-Host "Tailscale Funnel reset."
    exit 0
}

$status = (& $ts status --json 2>&1 | Out-String) | ConvertFrom-Json
if ($status.BackendState -ne 'Running') {
    throw "Tailscale is not connected (state: $($status.BackendState)). Log in to Tailscale first."
}

$output = (& $ts funnel --bg --yes $Port 2>&1 | Out-String)
Write-Host $output.Trim()
if ($LASTEXITCODE -ne 0) {
    throw "Tailscale Funnel failed to start. Enable Funnel for this tailnet in the Tailscale admin console, then retry."
}

$dns = [string]$status.Self.DNSName
if (-not $dns) { throw "Tailscale did not report a DNS name for this computer." }
$url = 'https://' + $dns.TrimEnd('.')
$match = [regex]::Match($output, 'https://[a-z0-9.-]+\.ts\.net')
if ($match.Success) { $url = $match.Value }

$healthy = $false
for ($i = 0; $i -lt 30; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "$url/health" -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200 -and $response.Content -match '"ok"\s*:\s*true') {
            $healthy = $true
            break
        }
    } catch {}
    Start-Sleep -Seconds 1
}
if (-not $healthy) {
    throw "Funnel URL did not pass the health check: $url/health"
}

if ($WriteFixedRelay) {
    $path = Join-Path $env:USERPROFILE '.dsh-remote\fixed-relay.txt'
    Set-Content -LiteralPath $path -Value $url -Encoding ASCII
    Write-Host "Wrote fixed relay URL: $path"
    Write-Host "Close the current launcher, then start one-click again. Re-pair the phone once."
}

Write-Host "Funnel URL: $url"
