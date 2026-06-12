$exe = "C:\Users\EDY\WorkBuddy\2026-06-10-10-03-48\focusflow\release\win-unpacked\FocusFlow Desktop.exe"
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "FocusFlow.lnk"

# Remove old shortcut
if (Test-Path $shortcutPath) {
    Remove-Item $shortcutPath -Force
    Write-Host "Removed old shortcut"
}

# Create new shortcut
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($shortcutPath)
$sc.TargetPath = $exe
$sc.WorkingDirectory = Split-Path $exe -Parent
$sc.IconLocation = "$exe,0"
$sc.Description = "FocusFlow Desktop"
$sc.Save()

Write-Host "Shortcut created: $shortcutPath"
Write-Host "Target: $exe"
