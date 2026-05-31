param(
  [ValidateSet("dev", "build", "build-exe")]
  [string]$Mode = "dev"
)

$vswhere = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer\vswhere.exe"

if (-not (Test-Path $vswhere)) {
  throw "vswhere.exe was not found. Install Visual Studio Build Tools 2022 with the C++ workload."
}

$vsPath = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath

if (-not $vsPath) {
  throw "MSVC build tools were not found. Install the 'Desktop development with C++' workload."
}

$devCmd = Join-Path $vsPath "Common7\Tools\VsDevCmd.bat"

if (-not (Test-Path $devCmd)) {
  throw "VsDevCmd.bat was not found at $devCmd."
}

$npmArgs = switch ($Mode) {
  "dev" { "run tauri:dev" }
  "build" { "run tauri:build" }
  "build-exe" { "run tauri:build -- --no-bundle" }
}

$command = "call `"$devCmd`" -arch=x64 -host_arch=x64 && npm $npmArgs"
cmd.exe /d /s /c $command
exit $LASTEXITCODE
