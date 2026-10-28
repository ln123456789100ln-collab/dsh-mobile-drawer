$ErrorActionPreference = 'Stop'

$mutex = New-Object System.Threading.Mutex -ArgumentList $false, 'Local\DeepSeekRemoteKeepAwake'
$owned = $false
try {
    try {
        $owned = $mutex.WaitOne(0)
    } catch [System.Threading.AbandonedMutexException] {
        $owned = $true
    }
    if (-not $owned) { exit 0 }

    Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class DshKeepAwake {
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern uint SetThreadExecutionState(uint esFlags);
}
"@

    [uint32]$ES_CONTINUOUS = 2147483648
    [uint32]$ES_SYSTEM_REQUIRED = 1

    try {
        # Keep the system awake; the display may still turn off.
        [DshKeepAwake]::SetThreadExecutionState([uint32]($ES_CONTINUOUS -bor $ES_SYSTEM_REQUIRED)) | Out-Null
        while ($true) {
            Start-Sleep -Seconds 30
        }
    } finally {
        [DshKeepAwake]::SetThreadExecutionState($ES_CONTINUOUS) | Out-Null
    }
} finally {
    if ($owned) {
        $mutex.ReleaseMutex()
    }
    $mutex.Dispose()
}
