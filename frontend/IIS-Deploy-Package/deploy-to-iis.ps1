# Script de Despliegue Automático para IIS
# Generador de Reportes Frontend - Angular

param(
    [Parameter(Mandatory=$false)]
    [string]$SiteName = "Generador Reportes Frontend",
    
    [Parameter(Mandatory=$false)]
    [string]$AppPoolName = "GeneradorReportesFrontendPool",
    
    [Parameter(Mandatory=$false)]
    [string]$Port = "8080",
    
    [Parameter(Mandatory=$false)]
    [string]$PhysicalPath = "C:\inetpub\wwwroot\GeneradorReportes"
)

# Verificar que se ejecuta como Administrador
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator"))
{
    Write-Host "Este script debe ejecutarse como Administrador" -ForegroundColor Red
    Write-Host "Clic derecho en PowerShell -> 'Ejecutar como Administrador'" -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host "=== DESPLIEGUE DE GENERADOR REPORTES FRONTEND ===" -ForegroundColor Yellow
Write-Host ""

# Importar módulo de IIS
Import-Module WebAdministration -ErrorAction SilentlyContinue
if (-not (Get-Module WebAdministration)) {
    Write-Host "Error: Módulo WebAdministration no disponible. Instalar IIS Management Tools." -ForegroundColor Red
    exit 1
}

# Verificar URL Rewrite Module
$urlRewrite = Get-WindowsFeature -Name IIS-HttpRedirect -ErrorAction SilentlyContinue
if (-not $urlRewrite -or $urlRewrite.InstallState -ne "Installed") {
    Write-Host "Advertencia: URL Rewrite Module puede no estar instalado." -ForegroundColor Yellow
    Write-Host "Descarga desde: https://www.iis.net/downloads/microsoft/url-rewrite" -ForegroundColor Yellow
    Write-Host ""
}

# Crear directorio físico si no existe
Write-Host "1. Creando directorio físico: $PhysicalPath" -ForegroundColor Cyan
if (!(Test-Path $PhysicalPath)) {
    New-Item -ItemType Directory -Path $PhysicalPath -Force | Out-Null
    Write-Host "✓ Directorio creado" -ForegroundColor Green
} else {
    Write-Host "✓ Directorio ya existe" -ForegroundColor Green
}

# Crear Application Pool
Write-Host "2. Configurando Application Pool: $AppPoolName" -ForegroundColor Cyan
if (!(Get-IISAppPool -Name $AppPoolName -ErrorAction SilentlyContinue)) {
    New-WebAppPool -Name $AppPoolName
    Set-ItemProperty -Path "IIS:\AppPools\$AppPoolName" -Name "managedRuntimeVersion" -Value ""
    Set-ItemProperty -Path "IIS:\AppPools\$AppPoolName" -Name "enable32BitAppOnWin64" -Value $false
    Write-Host "✓ Application Pool creado" -ForegroundColor Green
} else {
    Write-Host "✓ Application Pool ya existe" -ForegroundColor Green
}

# Crear o actualizar sitio web
Write-Host "3. Configurando sitio web: $SiteName" -ForegroundColor Cyan
$existingSite = Get-Website -Name $SiteName -ErrorAction SilentlyContinue
if ($existingSite) {
    Write-Host "Sitio web ya existe. Actualizando configuración..." -ForegroundColor Yellow
    Set-ItemProperty -Path "IIS:\Sites\$SiteName" -Name "applicationPool" -Value $AppPoolName
    Set-ItemProperty -Path "IIS:\Sites\$SiteName" -Name "physicalPath" -Value $PhysicalPath
} else {
    New-Website -Name $SiteName -ApplicationPool $AppPoolName -PhysicalPath $PhysicalPath -Port $Port
    Write-Host "✓ Sitio web creado" -ForegroundColor Green
}

# Copiar archivos de la aplicación
Write-Host "4. Copiando archivos de la aplicación..." -ForegroundColor Cyan
$sourceFiles = Get-ChildItem -Path "." -File
foreach ($file in $sourceFiles) {
    if ($file.Name -ne "deploy-to-iis.ps1" -and $file.Name -ne "INSTRUCCIONES-DESPLIEGUE.md") {
        Copy-Item -Path $file.FullName -Destination $PhysicalPath -Force
        Write-Host "  → $($file.Name)" -ForegroundColor Gray
    }
}

# Establecer permisos
Write-Host "5. Configurando permisos..." -ForegroundColor Cyan
$acl = Get-Acl $PhysicalPath
$accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule("IIS_IUSRS", "ReadAndExecute", "ContainerInherit,ObjectInherit", "None", "Allow")
$acl.SetAccessRule($accessRule)
Set-Acl -Path $PhysicalPath -AclObject $acl
Write-Host "✓ Permisos configurados para IIS_IUSRS" -ForegroundColor Green

# Iniciar Application Pool y Sitio Web
Write-Host "6. Iniciando servicios..." -ForegroundColor Cyan
Start-WebAppPool -Name $AppPoolName
Start-Website -Name $SiteName
Write-Host "✓ Servicios iniciados" -ForegroundColor Green

Write-Host ""
Write-Host "=== DESPLIEGUE COMPLETADO EXITOSAMENTE ===" -ForegroundColor Green
Write-Host ""
Write-Host "Información del despliegue:" -ForegroundColor Yellow
Write-Host "• Sitio Web: $SiteName"
Write-Host "• Application Pool: $AppPoolName"  
Write-Host "• Ruta Física: $PhysicalPath"
Write-Host "• Puerto: $Port"
Write-Host "• URL: http://localhost:$Port"
Write-Host ""
Write-Host "Próximos pasos:" -ForegroundColor Yellow
Write-Host "1. Abrir navegador web"
Write-Host "2. Navegar a: http://localhost:$Port"
Write-Host "3. Verificar que la aplicación Angular funciona correctamente"
Write-Host "4. Probar navegación entre diferentes rutas"
Write-Host "5. Verificar conexión con el API backend"
Write-Host ""
Write-Host "Si hay problemas, revisar:" -ForegroundColor Yellow
Write-Host "• Event Viewer → Windows Logs → Application"
Write-Host "• IIS Manager → Sitio → Failed Request Tracing"
Write-Host "• Verificar que URL Rewrite Module esté instalado"
Write-Host ""

# Abrir el sitio en el navegador por defecto
$response = Read-Host "¿Abrir el sitio en el navegador? (s/n)"
if ($response.ToLower() -eq "s" -or $response.ToLower() -eq "si" -or $response.ToLower() -eq "sí") {
    Start-Process "http://localhost:$Port"
}
