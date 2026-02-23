# Sistema Generador de Reportes

Sistema completo para generar reportes basados en consultas SQL Server con análisis inteligente de parámetros.

## Arquitectura

### Backend - ASP.NET Core 9.0 (Clean Architecture)
- **Domain Layer**: Entidades y reglas de negocio
- **Application Layer**: Casos de uso con MediatR y AutoMapper
- **Infrastructure Layer**: Repositorios y servicios externos
- **Presentation Layer**: API Controllers con Swagger

### Frontend - Angular 18 con Material Design
- **Componentes modulares** con AG-Grid para visualización de datos
- **Interfaz responsive** y moderna
- **Búsqueda global** y filtros por columna
- **Exportación a Excel** integrada
- **Manejo inteligente de parámetros** de reportes

## Características Principales

### Análisis Inteligente de Parámetros SQL
El sistema analiza automáticamente las consultas SQL para identificar parámetros:
- Detecta parámetros con prefijo `@p` o `@`
- Infiere tipos de datos (DateTime, int, decimal, bool, string)
- Genera nombres amigables para la interfaz
- Validación automática de parámetros requeridos

### Ejemplos de Consultas Soportadas
```sql
-- Ejemplo 1: Función con parámetros
Select * 
From Empresa.FN_ExtractoCobranzaPorDias(@FechaActual, @pFechaCorte)  
Where IdEmpresa = @pIdEmpresa

-- Ejemplo 2: Vista con filtros
Select NumeroDocumento, TipoTransaccion, Fecha, Identificador,
       NombreProveedor, SubTotal, Descuento, ValorIVA, RetencionIVA,
       TotalDocumento, NombreEmpresa
From [dbo].[vReporte_DetalladoCompras] 
Where IdEmpresa = @pIdEmpresa And
      Fecha Between @pFechaInicial And @pFechaFinal
```

## Configuración del Proyecto

### Prerrequisitos
- .NET 9.0 SDK
- Node.js 18+
- Angular CLI 18+
- SQL Server (conexión a 108.181.184.17:1066)

### Backend Setup

1. **Restaurar paquetes NuGet**:
   ```bash
   cd "c:\FuentesERP\oDX\GeneradorReportesX\oDres.GeneradorReportes.WEBApi\oDres.GeneradorReportes.WEBApi"
   dotnet restore
   ```

2. **Configurar base de datos**:
   - La cadena de conexión ya está configurada en `appsettings.json`
   - Ejecutar migraciones de Entity Framework:
   ```bash
   dotnet ef database update
   ```

3. **Ejecutar API**:
   ```bash
   dotnet run
   ```
   La API estará disponible en: `https://localhost:7000`

### Frontend Setup

1. **Instalar dependencias**:
   ```bash
   cd "c:\FuentesERP\oDX\GeneradorReportesX\frontend"
   npm install
   ```

2. **Instalar Angular CLI (si no está instalado)**:
   ```bash
   npm install -g @angular/cli@18
   ```

3. **Ejecutar aplicación**:
   ```bash
   ng serve
   ```
   La aplicación estará disponible en: `http://localhost:4200`

## Estructura del Proyecto

### Backend
```
oDres.GeneradorReportes.WEBApi/
├── Domain/
│   ├── Entities/           # Modulo, Reporte
│   ├── Models/             # ReportParameter, ReportResult
│   └── Interfaces/         # IReportRepository, IModuleRepository
├── Application/
│   ├── DTOs/              # Data Transfer Objects
│   ├── Queries/           # MediatR Queries
│   ├── Handlers/          # Query Handlers
│   └── Mappings/          # AutoMapper Profiles
├── Infrastructure/
│   ├── Data/              # DbContext
│   ├── Repositories/      # Implementaciones de repositorios
│   └── Services/          # SqlParameterAnalyzer, ExcelExportService
└── Controllers/           # API Controllers
```

### Frontend
```
frontend/src/
├── app/
│   ├── components/
│   │   ├── report-viewer/           # Componente principal
│   │   └── parameter-input-dialog/  # Diálogo de parámetros
│   ├── models/            # Interfaces TypeScript
│   └── services/          # ReportService
└── styles.scss           # Estilos globales
```

## API Endpoints

### Módulos
- `GET /api/modules` - Obtener todos los módulos
- `GET /api/modules/{id}` - Obtener módulo por ID
- `GET /api/modules/{id}/reports` - Obtener reportes de un módulo

### Reportes
- `GET /api/reports` - Obtener todos los reportes
- `GET /api/reports/{id}` - Obtener reporte por ID
- `GET /api/reports/module/{moduleId}` - Reportes por módulo
- `GET /api/reports/{id}/parameters` - Analizar parámetros de reporte
- `POST /api/reports/execute` - Ejecutar reporte
- `POST /api/reports/analyze-parameters` - Analizar consulta SQL

### Exportación
- `POST /api/export/excel` - Exportar reporte a Excel

## Uso del Sistema

### 1. Seleccionar Módulo
- Al cargar la aplicación, se muestran todos los módulos disponibles
- Hacer clic en un módulo para ver sus reportes

### 2. Seleccionar Reporte
- Los reportes se filtran por el módulo seleccionado
- Al seleccionar un reporte, se analiza automáticamente si requiere parámetros

### 3. Ingresar Parámetros (si es necesario)
- Si el reporte requiere parámetros, se abre un diálogo
- Los campos se generan automáticamente según el tipo de dato detectado
- Validación de campos requeridos

### 4. Visualizar Resultados
- Grid interactivo con AG-Grid
- Búsqueda global en tiempo real
- Filtros por columna
- Ordenamiento y redimensionado de columnas
- Paginación automática

### 5. Exportar Datos
- Botón de exportación a Excel
- Mantiene el formato y los datos filtrados

## Tecnologías Utilizadas

### Backend
- ASP.NET Core 9.0
- Entity Framework Core 9.0
- MediatR 12.2.0
- AutoMapper 13.0.1
- FluentValidation 11.9.0
- EPPlus 7.0.5 (Excel)
- Swagger/OpenAPI

### Frontend
- Angular 18
- Angular Material
- AG-Grid Community
- RxJS
- File-Saver
- TypeScript

## Configuración de Base de Datos

### Servidor SQL Server
- **Servidor**: 108.181.184.17:1066
- **Usuario**: SA
- **Password**: oDr3esSQL2024%
- **Base de datos**: GeneradorReportes

### Tablas Requeridas
1. **Modulos** - Catálogo de módulos del sistema
2. **Reportes** - Definición de reportes con sus consultas SQL

## Despliegue en Producción

### Backend
1. Publicar la API en IIS o Azure App Service
2. Configurar cadena de conexión de producción
3. Habilitar HTTPS y CORS apropiadamente

### Frontend
1. Compilar para producción:
   ```bash
   ng build --configuration production
   ```
2. Desplegar archivos del directorio `dist/` en servidor web
3. Actualizar URL del API en `report.service.ts`

## Características Avanzadas

### Análisis de Parámetros SQL
- **Detección automática** de parámetros en consultas
- **Inferencia de tipos** basada en nombres y patrones
- **Generación de formularios** dinámicos
- **Valores por defecto** inteligentes

### Interfaz Moderna
- **Diseño responsivo** compatible con dispositivos móviles
- **Tema Material Design** consistente
- **Navegación intuitiva** con sidebar
- **Feedback visual** con spinners y notificaciones

### Rendimiento
- **Paginación server-side** para grandes conjuntos de datos
- **Carga asíncrona** de módulos y reportes
- **Caché de resultados** en el frontend
- **Optimización de consultas** SQL

## Próximos Pasos

1. **Autenticación y autorización** con JWT
2. **Cache distribuido** con Redis
3. **Logging estructurado** con Serilog
4. **Tests unitarios e integración**
5. **Métricas y monitoreo** con Application Insights
6. **Soporte para múltiples bases de datos**
7. **Editor de reportes** integrado
8. **Programación de reportes** automáticos
