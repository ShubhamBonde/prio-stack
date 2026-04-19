Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$ProjectDir = "d:\_Personal\Priostack"
$BackendDir = Join-Path $ProjectDir "backend"
$FrontendDir = Join-Path $ProjectDir "web"
$RuntimeDir = Join-Path $ProjectDir ".runtime"
$PidFile = Join-Path $RuntimeDir "priostack-processes.json"
$AppUrl = "http://localhost:5173"

if (-not (Test-Path $RuntimeDir)) {
    New-Item -ItemType Directory -Path $RuntimeDir | Out-Null
}

function Get-SavedPids {
    if (-not (Test-Path $PidFile)) { return @{} }
    try {
        $raw = Get-Content -Path $PidFile -Raw
        if ([string]::IsNullOrWhiteSpace($raw)) { return @{} }
        $obj = $raw | ConvertFrom-Json
        $map = @{}
        if ($null -ne $obj -and $null -ne $obj.PSObject.Properties["backendPid"]) {
            $map["backendPid"] = [int]$obj.backendPid
        }
        if ($null -ne $obj -and $null -ne $obj.PSObject.Properties["frontendPid"]) {
            $map["frontendPid"] = [int]$obj.frontendPid
        }
        return $map
    } catch {
        return @{}
    }
}

function Save-Pids([hashtable]$pids) {
    $pids | ConvertTo-Json | Set-Content -Path $PidFile -Encoding UTF8
}

function Test-ProcessAlive([int]$processId) {
    if ($processId -le 0) { return $false }
    try {
        $null = Get-Process -Id $processId -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

function Get-Pid([hashtable]$map, [string]$key) {
    if ($map.ContainsKey($key)) { return [int]$map[$key] }
    return 0
}

function Update-Status {
    $pids = Get-SavedPids
    $backendPid = Get-Pid $pids "backendPid"
    $frontendPid = Get-Pid $pids "frontendPid"
    $backendRunning = Test-ProcessAlive $backendPid
    $frontendRunning = Test-ProcessAlive $frontendPid

    $labelBackend.Text = if ($backendRunning) { "Backend: Running (PID $backendPid)" } else { "Backend: Stopped" }
    $labelFrontend.Text = if ($frontendRunning) { "Frontend: Running (PID $frontendPid)" } else { "Frontend: Stopped" }
    $labelState.Text = if ($backendRunning -and $frontendRunning) { "Overall: Running" } else { "Overall: Partially stopped" }
}

function Start-Priostack {
    if (-not (Test-Path $BackendDir) -or -not (Test-Path $FrontendDir)) {
        [System.Windows.Forms.MessageBox]::Show("Project folders were not found at $ProjectDir", "Priostack", "OK", "Error") | Out-Null
        return
    }

    # Always start from a clean session: stop prior processes started by this tool.
    Stop-Priostack

    $pids = Get-SavedPids
    $backendPid = Get-Pid $pids "backendPid"
    $frontendPid = Get-Pid $pids "frontendPid"

    if (-not (Test-ProcessAlive $backendPid)) {
        $backend = Start-Process powershell -WindowStyle Hidden -PassThru -ArgumentList @(
            "-NoProfile",
            "-ExecutionPolicy", "Bypass",
            "-Command", "Set-Location '$BackendDir'; python -m uvicorn app.main:app --reload --port 8000"
        )
        $pids["backendPid"] = $backend.Id
    }

    if (-not (Test-ProcessAlive $frontendPid)) {
        $frontend = Start-Process powershell -WindowStyle Hidden -PassThru -ArgumentList @(
            "-NoProfile",
            "-ExecutionPolicy", "Bypass",
            "-Command", "Set-Location '$FrontendDir'; npm run dev"
        )
        $pids["frontendPid"] = $frontend.Id
    }

    Save-Pids $pids
    Start-Sleep -Seconds 2
    Start-Process $AppUrl | Out-Null
    Update-Status
}

function Stop-Priostack {
    $pids = Get-SavedPids
    $backendPid = Get-Pid $pids "backendPid"
    $frontendPid = Get-Pid $pids "frontendPid"

    if (Test-ProcessAlive $backendPid) {
        Stop-Process -Id $backendPid -Force -ErrorAction SilentlyContinue
    }
    if (Test-ProcessAlive $frontendPid) {
        Stop-Process -Id $frontendPid -Force -ErrorAction SilentlyContinue
    }

    Save-Pids @{}
    Update-Status
}

function Show-Panel {
    $form.Show()
    $form.WindowState = [System.Windows.Forms.FormWindowState]::Normal
    $form.Activate()
}

$form = New-Object System.Windows.Forms.Form
$form.Text = "Priostack Control Panel"
$form.Size = New-Object System.Drawing.Size(500, 350)
$form.StartPosition = "CenterScreen"
$form.MinimumSize = New-Object System.Drawing.Size(350, 350)
$form.MaximumSize = New-Object System.Drawing.Size(500, 500)
$form.BackColor = [System.Drawing.Color]::FromArgb(245, 247, 251)

$labelTitle = New-Object System.Windows.Forms.Label
$labelTitle.Text = "Priostack Launcher"
$labelTitle.Font = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)
$labelTitle.AutoSize = $true
$labelTitle.Location = New-Object System.Drawing.Point(20, 20)
$form.Controls.Add($labelTitle)

$labelHint = New-Object System.Windows.Forms.Label
$labelHint.Text = "Start/stop backend + frontend without terminal windows."
$labelHint.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$labelHint.AutoSize = $true
$labelHint.Location = New-Object System.Drawing.Point(22, 55)
$form.Controls.Add($labelHint)

$groupStatus = New-Object System.Windows.Forms.GroupBox
$groupStatus.Text = "Status"
$groupStatus.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$groupStatus.Size = New-Object System.Drawing.Size(445, 110)
$groupStatus.Location = New-Object System.Drawing.Point(20, 88)
$form.Controls.Add($groupStatus)

$labelBackend = New-Object System.Windows.Forms.Label
$labelBackend.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$labelBackend.AutoSize = $true
$labelBackend.Location = New-Object System.Drawing.Point(18, 30)
$groupStatus.Controls.Add($labelBackend)

$labelFrontend = New-Object System.Windows.Forms.Label
$labelFrontend.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$labelFrontend.AutoSize = $true
$labelFrontend.Location = New-Object System.Drawing.Point(18, 55)
$groupStatus.Controls.Add($labelFrontend)

$labelState = New-Object System.Windows.Forms.Label
$labelState.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$labelState.AutoSize = $true
$labelState.Location = New-Object System.Drawing.Point(18, 80)
$groupStatus.Controls.Add($labelState)

$btnStart = New-Object System.Windows.Forms.Button
$btnStart.Text = "Start Application"
$btnStart.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$btnStart.Size = New-Object System.Drawing.Size(210, 44)
$btnStart.Location = New-Object System.Drawing.Point(20, 215)
$btnStart.Add_Click({ Start-Priostack })
$form.Controls.Add($btnStart)

$btnStop = New-Object System.Windows.Forms.Button
$btnStop.Text = "Stop Application"
$btnStop.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$btnStop.Size = New-Object System.Drawing.Size(210, 44)
$btnStop.Location = New-Object System.Drawing.Point(255, 215)
$btnStop.Add_Click({ Stop-Priostack })
$form.Controls.Add($btnStop)

$btnOpen = New-Object System.Windows.Forms.Button
$btnOpen.Text = "Open in Browser"
$btnOpen.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$btnOpen.Size = New-Object System.Drawing.Size(210, 36)
$btnOpen.Location = New-Object System.Drawing.Point(20, 268)
$btnOpen.Add_Click({ Start-Process $AppUrl | Out-Null })
$form.Controls.Add($btnOpen)

$btnRefresh = New-Object System.Windows.Forms.Button
$btnRefresh.Text = "Refresh Status"
$btnRefresh.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$btnRefresh.Size = New-Object System.Drawing.Size(210, 36)
$btnRefresh.Location = New-Object System.Drawing.Point(255, 268)
$btnRefresh.Add_Click({ Update-Status })
$form.Controls.Add($btnRefresh)

$trayMenu = New-Object System.Windows.Forms.ContextMenuStrip
$trayStart = $trayMenu.Items.Add("Start Application")
$trayStop = $trayMenu.Items.Add("Stop Application")
$trayOpen = $trayMenu.Items.Add("Open in Browser")
$trayShow = $trayMenu.Items.Add("Show Control Panel")
$null = $trayMenu.Items.Add("-")
$trayExit = $trayMenu.Items.Add("Exit")

$notifyIcon = New-Object System.Windows.Forms.NotifyIcon
$notifyIcon.Icon = [System.Drawing.SystemIcons]::Application
$notifyIcon.Text = "Priostack Control Panel"
$notifyIcon.Visible = $true
$notifyIcon.ContextMenuStrip = $trayMenu

$trayStart.add_Click({ Start-Priostack })
$trayStop.add_Click({ Stop-Priostack })
$trayOpen.add_Click({ Start-Process $AppUrl | Out-Null })
$trayShow.add_Click({ Show-Panel })
$trayExit.add_Click({
    Stop-Priostack
    $notifyIcon.Visible = $false
    $notifyIcon.Dispose()
    $form.Close()
})
$notifyIcon.add_DoubleClick({ Show-Panel })

$form.Add_Resize({
    if ($form.WindowState -eq [System.Windows.Forms.FormWindowState]::Minimized) {
        $form.Hide()
        $notifyIcon.BalloonTipTitle = "Priostack"
        $notifyIcon.BalloonTipText = "Still running in tray. Double-click icon to reopen."
        $notifyIcon.ShowBalloonTip(1200)
    }
})

$form.Add_FormClosing({
    Stop-Priostack
    if ($notifyIcon.Visible) {
        $notifyIcon.Visible = $false
        $notifyIcon.Dispose()
    }
})

$statusTimer = New-Object System.Windows.Forms.Timer
$statusTimer.Interval = 4000
$statusTimer.Add_Tick({ Update-Status })
$statusTimer.Start()

Update-Status
[void]$form.ShowDialog()
