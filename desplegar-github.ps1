#Requires -Version 5.1
<#
.SYNOPSIS
  Publica este proyecto en GitHub como repositorio demopresenciaV2.

.USAGE
  1. Instalá Git: https://git-scm.com/download/win
  2. Instalá GitHub CLI: https://cli.github.com/
  3. Autenticá: gh auth login
  4. Ejecutá: .\desplegar-github.ps1

  Opcional:
    .\desplegar-github.ps1 -RepoName demopresenciaV2 -Visibility private
#>
param(
  [string]$RepoName = 'demopresenciaV2',
  [ValidateSet('public', 'private')]
  [string]$Visibility = 'public',
  [string]$GitHubUser = ''
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

function Require-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "No se encontró '$Name'. Instalalo y volvé a abrir la terminal."
  }
}

function Test-SecretsNotStaged {
  $trackedSecrets = @(
    'server/.env',
    'server/data/demo-users.json'
  )
  foreach ($file in $trackedSecrets) {
    if (Test-Path $file) {
      $status = & git status --porcelain -- $file 2>$null
      if ($status -match '^A |^\?\?') {
        throw "Archivo sensible listo para commit: $file. Revisá .gitignore antes de continuar."
      }
    }
  }
}

Write-Host "==> Verificando herramientas..."
Require-Command git
Require-Command gh

if (-not $GitHubUser) {
  $GitHubUser = (gh api user -q .login)
}
if (-not $GitHubUser) {
  throw 'No se pudo detectar tu usuario de GitHub. Usá: gh auth login'
}

$remoteUrl = "https://github.com/$GitHubUser/$RepoName.git"
Write-Host "==> Repositorio destino: $remoteUrl ($Visibility)"

if (-not (Test-Path '.git')) {
  Write-Host '==> Inicializando git...'
  git init -b main
}

if (-not (Test-Path 'server/.env.example')) {
  throw 'Falta server/.env.example'
}

Write-Host '==> Preparando commit inicial...'
git add .
Test-SecretsNotStaged

$pending = git status --porcelain
if (-not $pending) {
  Write-Host 'No hay cambios nuevos para commitear.'
} else {
  git commit -m @"
Publicar demo presencial V2.

Incluye frontend estático, proxy Node.js, CI de seguridad y configuración
de ejemplo para despliegue local con npm start.
"@
}

$remoteExists = git remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0) {
  git remote add origin $remoteUrl
} elseif ($remoteExists -ne $remoteUrl) {
  Write-Host "==> Actualizando remote origin -> $remoteUrl"
  git remote set-url origin $remoteUrl
}

Write-Host '==> Creando repositorio en GitHub (si no existe)...'
$createArgs = @(
  'repo', 'create', "$GitHubUser/$RepoName",
  "--$Visibility",
  '--source=.',
  '--remote=origin',
  '--push'
)
try {
  gh @createArgs | Out-Host
} catch {
  Write-Host 'El repo puede existir ya. Intentando push...'
  git push -u origin main
}

Write-Host ''
Write-Host 'Listo.'
Write-Host "Repo: https://github.com/$GitHubUser/$RepoName"
Write-Host ''
Write-Host 'Próximos pasos:'
Write-Host '  - En el servidor de demo: copiar server/.env.example a server/.env'
Write-Host '  - No subas secretos reales al repositorio'
Write-Host '  - Para GitHub Pages (solo estático): configurá Pages desde Settings > Pages'
