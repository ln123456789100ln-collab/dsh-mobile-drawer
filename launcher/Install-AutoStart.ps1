param([switch]$Remove, [string]$ShortcutDirectory = '')

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$startup = if ($ShortcutDirectory) { $ShortcutDirectory } else { [Environment]::GetFolderPath('Startup') }
$shortcutPath = Join-Path $startup 'DeepSeek 手机远程.lnk'

if ($Remove) {
    if (Test-Path -LiteralPath $shortcutPath) {
        Remove-Item -LiteralPath $shortcutPath -Force
        Write-Host "Removed auto-start shortcut: $shortcutPath"
    } else {
        Write-Host "Auto-start shortcut was not installed."
    }
    exit 0
}

$vbs = Join-Path $root 'Start-All-Silent.vbs'
if (-not (Test-Path -LiteralPath $vbs)) {
    throw "Start-All-Silent.vbs not found next to this script."
}

if (-not (Test-Path -LiteralPath $startup)) {
    New-Item -ItemType Directory -Path $startup -Force | Out-Null
}
$wscript = Join-Path $env:SystemRoot 'System32\wscript.exe'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $wscript
$shortcut.Arguments = '"' + $vbs + '"'
$shortcut.WorkingDirectory = $root
$shortcut.WindowStyle = 7
$shortcut.Description = 'Start DeepSeek phone remote access at logon'
$shortcut.Save()

if (-not (Test-Path -LiteralPath $shortcutPath)) {
    throw "Failed to create the Startup shortcut."
}
Write-Host "Installed auto-start shortcut: $shortcutPath"
Write-Host "It starts hidden at the next Windows logon and does not open a browser."
Write-Host "Remove it with: powershell -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Remove"
