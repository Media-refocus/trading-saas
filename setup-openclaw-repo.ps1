# Script para crear repositorio OpenClaw
# Usuario: Media-refocus

Write-Host "🚀 CONFIGURACIÓN REPOSITORIO OPENCLAW" -ForegroundColor Cyan
Write-Host ""
Write-Host "Este script creará el repositorio para OpenClaw" -ForegroundColor Yellow
Write-Host "y preparará el código para trabajar en remoto." -ForegroundColor Yellow
Write-Host ""

$REPO_NAME = "trading-bot-saas-openclaw"
$GITHUB_USER = "Media-refocus"
$MAIN_BRANCH = "master"

Write-Host "✅ Repositorio: $REPO_NAME" -ForegroundColor Green
Write-Host "✅ Usuario: $GITHUB_USER" -ForegroundColor Green
Write-Host "✅ Rama actual: $MAIN_BRANCH" -ForegroundColor Green
Write-Host ""

# Instrucciones para GitHub
Write-Host "📋 PASOS A SEGUIR EN GITHUB:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Ve a: https://github.com/new" -ForegroundColor White
Write-Host "2. Crea un NUEVO repositorio:" -ForegroundColor White
Write-Host "   - Repository name: $REPO_NAME" -ForegroundColor Yellow
Write-Host "   - Description: SaaS de trading automatizado - Backtesting para OpenClaw" -ForegroundColor Yellow
Write-Host "   - Visibility: Private (recomendado)" -ForegroundColor Yellow
Write-Host "   - NO marcar 'Add a README'" -ForegroundColor Yellow
Write-Host "   - NO marcar 'Add .gitignore'" -ForegroundColor Yellow
Write-Host ""
Write-Host "3. Una vez creado, el repositorio estará en:" -ForegroundColor White
Write-Host "   https://github.com/$GITHUB_USER/$REPO_NAME" -ForegroundColor Green
Write-Host ""

# Preguntar si está creado
$respuesta = Read-Host "¿Has creado el repositorio? (s/n)" -ForegroundColor Cyan
if ($respuesta -eq "s" -or $respuesta -eq "S") {
    Write-Host ""
    Write-Host "✅ Repositorio creado. Configurando git remote..." -ForegroundColor Green
    Write-Host ""

    # Configurar remote
    cd "C:\Users\guill\projects\trading-bot-saas"
    git remote add origin "https://github.com/$GITHUB_USER/$REPO_NAME.git" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Remote configurado correctamente" -ForegroundColor Green
        Write-Host ""
        Write-Host "📤 Ahora voy a hacer push del código..." -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Ejecuta: git push -u origin $MAIN_BRANCH" -ForegroundColor Yellow
        Write-Host ""
    } else {
        Write-Host "❌ Error configurando remote" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host ""
    Write-Host "⏸ Por favor, crea el repositorio primero y ejecuta este script de nuevo." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Cuando lo hayas creado, ejecuta:" -ForegroundColor White
    Write-Host "git remote add origin https://github.com/$GITHUB_USER/$REPO_NAME.git" -ForegroundColor Cyan
    Write-Host "git push -u origin $MAIN_BRANCH" -ForegroundColor Cyan
    Write-Host ""
}

Write-Host "📖 Más información en: SETUP_INSTRUCCIONES.md" -ForegroundColor Cyan
Write-Host ""
