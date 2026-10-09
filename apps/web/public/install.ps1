#!/usr/bin/env pwsh
# Bootstraps `p2p-academy` on a machine with nothing installed yet.
#
#   irm https://p2pacademy.cc/install.ps1 | iex
#
# Only job: get Node running against a checkout so apps/cli/src/install.js
# (the actual install logic) can take over from there. Windows counterpart
# of install.sh; keep both in sync.

$ErrorActionPreference = 'Stop'
# 5.1's progress bar slows Invoke-WebRequest to a crawl on large zips.
$ProgressPreference = 'SilentlyContinue'

# Windows PowerShell 5.1 can default to TLS 1.0, so enable 1.2 for the ffmpeg
# download below. Also covers running this file directly, without the one-liner.
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$RepoUrl = 'https://github.com/thisonedev/p2p-academy.git'
$Branch = 'master'
# Repo and branch overrides are for testing unmerged work, so they need P2P_ACADEMY_DEV=1.
if ($env:P2P_ACADEMY_DEV -eq '1') {
  if ($env:P2P_ACADEMY_REPO) { $RepoUrl = $env:P2P_ACADEMY_REPO }
  if ($env:P2P_ACADEMY_BRANCH) { $Branch = $env:P2P_ACADEMY_BRANCH }
}

# Fails unless the file matches the SHA-256 its publisher lists for it.
function Assert-Sha256($Path, $Expected) {
  if ($Expected -notmatch '^[0-9a-fA-F]{64}$') { throw "no published SHA-256 for $(Split-Path -Leaf $Path)" }
  $Actual = (Get-FileHash -Algorithm SHA256 -Path $Path).Hash
  if ($Actual -ne $Expected.ToUpperInvariant()) { throw "SHA-256 mismatch for $(Split-Path -Leaf $Path)" }
}

# The hex from a release asset's "sha256:<hex>" digest, or $null when GitHub lists none.
function Get-AssetSha256($Asset) {
  if ($Asset -and $Asset.digest -match '^sha256:([0-9a-f]{64})$') { return $Matches[1] }
  return $null
}

# Unzips a portable build into the user's profile and puts $BinDir on PATH,
# persisted for later sessions (the p2p-academy shim and `update` need both).
# No winget: it's missing on older and LTSC Windows 10 builds.
function Install-PortableZip($Name, $Url, $Sha256, $Dest, $BinDir) {
  Write-Host "-> Installing $Name..."
  try {
    $Work = Join-Path ([System.IO.Path]::GetTempPath()) "p2p-academy-$Name-$([System.IO.Path]::GetRandomFileName())"
    New-Item -ItemType Directory -Path $Work | Out-Null
    $Zip = Join-Path $Work "$Name.zip"
    Invoke-WebRequest -Uri $Url -OutFile $Zip -UseBasicParsing
    Assert-Sha256 $Zip $Sha256
    $Out = Join-Path $Work 'out'
    Expand-Archive -Path $Zip -DestinationPath $Out -Force
    # Node's zip nests everything under one folder, MinGit's doesn't.
    $Root = @(Get-ChildItem -Path $Out)
    $Src = if ($Root.Count -eq 1 -and $Root[0].PSIsContainer) { $Root[0].FullName } else { $Out }
    New-Item -ItemType Directory -Force -Path $Dest | Out-Null
    Copy-Item -Path (Join-Path $Src '*') -Destination $Dest -Recurse -Force
    Remove-Item -Recurse -Force $Work -ErrorAction SilentlyContinue
    $UserPath = [System.Environment]::GetEnvironmentVariable('Path', 'User')
    if ($UserPath -notlike "*$BinDir*") {
      [System.Environment]::SetEnvironmentVariable('Path', "$UserPath;$BinDir", 'User')
    }
    $env:Path = "$BinDir;$env:Path"
  } catch {
    Write-Error "$Name install failed: $($_.Exception.Message). Install it manually, then retry."
    exit 1
  }
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  $Release = Invoke-RestMethod -Uri 'https://api.github.com/repos/git-for-windows/git/releases/latest' -UseBasicParsing
  $Asset = $Release.assets | Where-Object { $_.name -match '^MinGit-[\d.]+-64-bit\.zip$' } | Select-Object -First 1
  $GitDir = Join-Path $env:LOCALAPPDATA 'p2p-academy\git'
  Install-PortableZip 'git' $Asset.browser_download_url (Get-AssetSha256 $Asset) $GitDir (Join-Path $GitDir 'cmd')
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  # Assigned first: 5.1 pipes a JSON array from Invoke-RestMethod as one object.
  $Releases = Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json' -UseBasicParsing
  $Lts = ($Releases | Where-Object { $_.lts } | Select-Object -First 1).version
  $Arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
  $NodeZip = "node-$Lts-win-$Arch.zip"
  $Sums = (Invoke-WebRequest -Uri "https://nodejs.org/dist/$Lts/SHASUMS256.txt" -UseBasicParsing).Content
  $NodeSha = $Sums -split "`n" | ForEach-Object { if ($_ -match "^([0-9a-f]{64})\s+$([regex]::Escape($NodeZip))\s*$") { $Matches[1] } } | Select-Object -First 1
  $NodeDir = Join-Path $env:LOCALAPPDATA 'p2p-academy\node'
  Install-PortableZip 'node' "https://nodejs.org/dist/$Lts/$NodeZip" $NodeSha $NodeDir $NodeDir
}

# npm.cmd, not bare npm: PowerShell resolves that to npm.ps1, which the
# default Restricted execution policy blocks.
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  Write-Host "-> Installing pnpm..."
  npm.cmd install -g pnpm@9.15.9
  # npm doesn't touch the registry PATH itself; it assumes the global prefix
  # is already on it, which only holds if something else put it there. Ask
  # npm directly where it just put pnpm's shim and prepend that instead.
  # Persisted too: a portable Node never registers it like the MSI does.
  $npmPrefix = (npm.cmd config get prefix -g).Trim()
  if ($npmPrefix -and (Test-Path $npmPrefix)) {
    $UserPath = [System.Environment]::GetEnvironmentVariable('Path', 'User')
    if ($UserPath -notlike "*$npmPrefix*") {
      [System.Environment]::SetEnvironmentVariable('Path', "$UserPath;$npmPrefix", 'User')
    }
    if ($env:Path -notlike "*$npmPrefix*") { $env:Path = "$npmPrefix;$env:Path" }
  }
}

# Mic lessons spawn ffmpeg directly and it's never bundled, so self-heal it
# like git/node/pnpm above. Confined to the user's own profile: unlike provision.ps1, this
# script never runs elevated.
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  Write-Host "-> Installing ffmpeg..."
  $FfmpegDest = Join-Path $env:LOCALAPPDATA 'p2p-academy\ffmpeg'
  try {
    $FfmpegWork = Join-Path ([System.IO.Path]::GetTempPath()) "p2p-academy-ffmpeg-$([System.IO.Path]::GetRandomFileName())"
    New-Item -ItemType Directory -Path $FfmpegWork | Out-Null
    # gyan.dev's builds, from its GitHub mirror so the download has a published digest.
    $FfReleases = @(Invoke-RestMethod -Uri 'https://api.github.com/repos/GyanD/codexffmpeg/releases?per_page=20' -UseBasicParsing)
    $FfAsset = $FfReleases | ForEach-Object { $_.assets } | Where-Object { $_.name -match '^ffmpeg-[\d.]+-essentials_build\.zip$' } | Select-Object -First 1
    if (-not $FfAsset) { throw 'no ffmpeg essentials build found on GyanD/codexffmpeg' }
    $FfZip = Join-Path $FfmpegWork 'ffmpeg.zip'
    Invoke-WebRequest -Uri $FfAsset.browser_download_url -OutFile $FfZip -UseBasicParsing
    Assert-Sha256 $FfZip (Get-AssetSha256 $FfAsset)
    Expand-Archive -Path $FfZip -DestinationPath $FfmpegWork -Force
    $FfBinSrc = Get-ChildItem -Path $FfmpegWork -Recurse -Directory -Filter 'bin' | Select-Object -First 1
    New-Item -ItemType Directory -Force -Path $FfmpegDest | Out-Null
    Copy-Item -Path (Join-Path $FfBinSrc.FullName '*') -Destination $FfmpegDest -Force
    Remove-Item -Recurse -Force $FfmpegWork -ErrorAction SilentlyContinue
    # Confirm the extracted binary actually runs before trusting it on PATH;
    # a truncated download or a zip layout change should fail loudly here,
    # not resurface later as a confusing mic-lesson error.
    & (Join-Path $FfmpegDest 'ffmpeg.exe') -version | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "ffmpeg.exe -version exited $LASTEXITCODE" }
    $UserPath = [System.Environment]::GetEnvironmentVariable('Path', 'User')
    if ($UserPath -notlike "*$FfmpegDest*") {
      [System.Environment]::SetEnvironmentVariable('Path', "$UserPath;$FfmpegDest", 'User')
    }
    $env:Path = "$env:Path;$FfmpegDest"
  } catch {
    Write-Error "ffmpeg install failed: $($_.Exception.Message). Install it manually from https://www.gyan.dev/ffmpeg/builds/ (essentials build) and put it on PATH, then retry."
    exit 1
  }
}

$TmpDir = Join-Path ([System.IO.Path]::GetTempPath()) "p2p-academy-bootstrap-$([System.IO.Path]::GetRandomFileName())"
New-Item -ItemType Directory -Path $TmpDir | Out-Null

try {
  Write-Host "-> Fetching installer from $RepoUrl ($Branch)..."
  git clone --quiet --depth 1 --branch $Branch $RepoUrl $TmpDir

  # bootstrap-install.js skips cli.js/paparam (see that file for why).
  node (Join-Path $TmpDir 'apps\cli\bin\bootstrap-install.js')

  # install.js only prints a setx suggestion: setx persists to the registry
  # but can't reach this already-running session, and this is the one place
  # in the whole flow that runs in-process in the user's real shell (via iex)
  # instead of a child process, so it's the only place that actually can.
  $ShimDir = Join-Path $env:LOCALAPPDATA 'p2p-academy\bin'
  $UserPath = [System.Environment]::GetEnvironmentVariable('Path', 'User')
  if ($UserPath -notlike "*$ShimDir*") {
    [System.Environment]::SetEnvironmentVariable('Path', "$UserPath;$ShimDir", 'User')
  }
  if ($env:Path -notlike "*$ShimDir*") {
    $env:Path = "$env:Path;$ShimDir"
    Write-Host "-> Added $ShimDir to your PATH"
  }
} finally {
  Remove-Item -Recurse -Force $TmpDir -ErrorAction SilentlyContinue
}
