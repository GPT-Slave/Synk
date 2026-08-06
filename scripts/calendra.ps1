<#
  Synk launcher — run via `pnpm run synk` from the repo root.
  Verifies prerequisites, sets up the environment, then starts api + web.
#>

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

function Write-Step($msg)  { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)    { Write-Host "    [OK] $msg" -ForegroundColor Green }
function Fail($msg) {
    Write-Host "    [FAIL] $msg" -ForegroundColor Red
    exit 1
}

# ---------------------------------------------------------------------------
# 1. Prerequisites
# ---------------------------------------------------------------------------
Write-Step "Checking prerequisites"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail "Node.js not found. Install Node 22." }
$nodeMajor = [int](node -p "process.versions.node.split('.')[0]")
if ($nodeMajor -ne 22) { Fail "Node 22 required (found $(node -v))." }
Write-Ok "Node $(node -v)"

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    if (Get-Command corepack -ErrorAction SilentlyContinue) {
        # Materialize pnpm shims in a user-writable dir and put them on PATH for this session
        $shimDir = Join-Path $env:LOCALAPPDATA "corepack-shims"
        New-Item -ItemType Directory -Force -Path $shimDir | Out-Null
        corepack enable --install-directory $shimDir 2>$null
        $env:Path = "$shimDir;$env:Path"
    }
    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
        Fail "pnpm not found. Run 'corepack enable' or 'npm i -g pnpm'."
    }
}
Write-Ok "pnpm $(pnpm -v)"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { Fail "Docker not found. Install Docker Desktop." }
docker info *> $null
if ($LASTEXITCODE -ne 0) { Fail "Docker daemon is not running. Start Docker Desktop and retry." }
Write-Ok "Docker is running"

# ---------------------------------------------------------------------------
# 2. Environment file
# ---------------------------------------------------------------------------
Write-Step "Checking environment"

$envFile = Join-Path $Root "apps\api\.env"
$envExample = Join-Path $Root "apps\api\.env.example"
if (-not (Test-Path $envFile)) {
    Copy-Item $envExample $envFile
    Write-Ok "Created apps/api/.env from .env.example"
} else {
    Write-Ok "apps/api/.env exists"
}
if (-not (Select-String -Path $envFile -Pattern '^DATABASE_URL=' -Quiet)) {
    Fail "DATABASE_URL missing in apps/api/.env"
}

# ---------------------------------------------------------------------------
# 3. Install dependencies
# ---------------------------------------------------------------------------
Write-Step "Installing dependencies"
Push-Location $Root
try {
    pnpm install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { Fail "pnpm install failed." }
    Write-Ok "Dependencies installed"
} finally {
    Pop-Location
}

# ---------------------------------------------------------------------------
# 4. PostgreSQL
# ---------------------------------------------------------------------------
Write-Step "Starting PostgreSQL"
Push-Location $Root
try {
    docker compose up -d db
    if ($LASTEXITCODE -ne 0) { Fail "PostgreSQL could not be started." }
    Write-Ok "PostgreSQL container started"
} finally {
    Pop-Location
}

# Wait until PostgreSQL is accepting connections
Write-Host "    Waiting for PostgreSQL" -NoNewline
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    docker compose exec -T db pg_isready -U postgres *> $null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Write-Host "." -NoNewline
    Start-Sleep -Seconds 1
}
Write-Host ""
if (-not $ready) { Fail "PostgreSQL did not become ready within 30 seconds." }
Write-Ok "PostgreSQL is ready"

# ---------------------------------------------------------------------------
# 5. Prisma
# ---------------------------------------------------------------------------
Write-Step "Preparing database"
Push-Location $Root
try {
    pnpm prisma:generate
    if ($LASTEXITCODE -ne 0) { Fail "Prisma client generation failed." }
    pnpm prisma:migrate
    if ($LASTEXITCODE -ne 0) { Fail "Prisma migration failed." }
    Write-Ok "Database is ready"
} finally {
    Pop-Location
}

# ---------------------------------------------------------------------------
# 6. Typecheck
# ---------------------------------------------------------------------------
Write-Step "Checking TypeScript"
Push-Location $Root
try {
    pnpm --filter api typecheck
    if ($LASTEXITCODE -ne 0) { Fail "API typecheck failed." }
    Write-Ok "API typecheck passed"
    pnpm --filter web typecheck
    if ($LASTEXITCODE -ne 0) { Fail "Web typecheck failed." }
    Write-Ok "Web typecheck passed"
} finally {
    Pop-Location
}

# ---------------------------------------------------------------------------
# 7. Start
# ---------------------------------------------------------------------------
Write-Step "Starting Synk"
Write-Host "    API -> http://localhost:4000" -ForegroundColor Gray
Write-Host "    Web -> http://localhost:3000" -ForegroundColor Gray
Write-Host "    Press Ctrl+C to stop both.`n" -ForegroundColor Gray

Push-Location $Root
try {
    pnpm exec concurrently --kill-others-on-fail --names api,web --prefix-colors magenta,cyan "pnpm dev:api" "pnpm dev:web"
} finally {
    Pop-Location
}
