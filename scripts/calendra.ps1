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

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail "Node.js not found. Install Node >= 18." }
$nodeMajor = [int](node -p "process.versions.node.split('.')[0]")
if ($nodeMajor -lt 18) { Fail "Node >= 18 required (found $(node -v))." }
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
# 3. Dependencies
# ---------------------------------------------------------------------------
Write-Step "Installing dependencies"
Push-Location $Root
pnpm install
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "pnpm install failed." }
Pop-Location
Write-Ok "Dependencies installed"

# ---------------------------------------------------------------------------
# 4. Database (Postgres via Docker)
# ---------------------------------------------------------------------------
Write-Step "Starting Postgres"
docker compose -f (Join-Path $Root "docker-compose.yml") up -d db
if ($LASTEXITCODE -ne 0) { Fail "docker compose up failed." }

Write-Host "    Waiting for Postgres to be ready..." -ForegroundColor Gray
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    docker exec calendra-db pg_isready -U postgres -d meetplanner *> $null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 2
}
if (-not $ready) { Fail "Postgres did not become ready in time." }
Write-Ok "Postgres is ready on localhost:5432"

# ---------------------------------------------------------------------------
# 5. Prisma — generate client + apply migrations
# ---------------------------------------------------------------------------
Write-Step "Syncing database schema (Prisma)"
Push-Location (Join-Path $Root "apps\api")

pnpm exec prisma generate
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "prisma generate failed." }
Write-Ok "Prisma client generated"

$migrationsDir = Join-Path $Root "apps\api\prisma\migrations"
if (Test-Path $migrationsDir) {
    pnpm exec prisma migrate deploy
} else {
    pnpm exec prisma migrate dev --name init
}
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "prisma migrate failed." }
Pop-Location
Write-Ok "Database schema up to date"

# ---------------------------------------------------------------------------
# 6. Verification — typecheck both apps
# ---------------------------------------------------------------------------
Write-Step "Verifying build (typecheck)"
Push-Location (Join-Path $Root "apps\api")
pnpm exec tsc --noEmit -p tsconfig.json
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "API typecheck failed." }
Pop-Location
Write-Ok "API typecheck passed"

Push-Location (Join-Path $Root "apps\web")
pnpm exec tsc --noEmit -p tsconfig.json
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "Web typecheck failed." }
Pop-Location
Write-Ok "Web typecheck passed"

# ---------------------------------------------------------------------------
# 7. Launch
# ---------------------------------------------------------------------------
Write-Step "Starting Synk"
Write-Host "    API -> http://localhost:4000" -ForegroundColor Gray
Write-Host "    Web -> http://localhost:3000" -ForegroundColor Gray
Write-Host "    Press Ctrl+C to stop both.`n" -ForegroundColor Gray

Push-Location $Root
pnpm exec concurrently --kill-others --names "api,web" --prefix-colors "yellow,magenta" `
    "pnpm --filter api start:dev" `
    "pnpm --filter web dev"
Pop-Location
