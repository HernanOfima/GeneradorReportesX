import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError, tap, throwError } from 'rxjs';
import { Module, Report, ReportResult, ReportParameter, ExecuteReportRequest, ExportRequest } from '../models/report.models';
import { saveAs } from 'file-saver';

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private readonly apiUrl = 'https://localhost:7000/api';
  private readonly useMockData = false; // Force API usage for real data

  constructor(private http: HttpClient) { }

  // Mock data para pruebas
  private getMockModules(): Module[] {
    return [
      {
        idModulo: '1',
        nombre: 'Ventas',
        administrador: true,
        fechaRegistro: new Date(),
        fechaActualizacion: new Date(),
        usuario: 'admin',
        programa: 'GeneradorReportes',
        activo: true,
        reportes: [
          {
            idReporte: '1',
            nombre: 'ventas_detallado',
            titulo: 'Reporte de Ventas Detallado',
            sentenciaSQL: 'SELECT * FROM vw_VentasDetalladas WHERE Fecha BETWEEN @pFechaInicial AND @pFechaFinal',
            tipoReporte: 1, // Query/Vista
            idModulo: '1',
            moduloNombre: 'Ventas'
          },
          {
            idReporte: '2',
            nombre: 'productos_top',
            titulo: 'Top 10 Productos Más Vendidos',
            sentenciaSQL: 'SELECT TOP 10 * FROM vw_ProductosVentas ORDER BY CantidadVendida DESC',
            tipoReporte: 1, // Query/Vista
            idModulo: '1',
            moduloNombre: 'Ventas'
          }
        ]
      },
      {
        idModulo: '2',
        nombre: 'Inventario',
        administrador: true,
        fechaRegistro: new Date(),
        fechaActualizacion: new Date(),
        usuario: 'admin',
        programa: 'GeneradorReportes',
        activo: true,
        reportes: [
          {
            idReporte: '3',
            nombre: 'stock_bodega',
            titulo: 'Stock Actual por Bodega',
            sentenciaSQL: 'SELECT * FROM vw_StockActual WHERE IdBodega = @pIdBodega',
            tipoReporte: 1, // Query/Vista
            idModulo: '2',
            moduloNombre: 'Inventario'
          },
          {
            idReporte: '4',
            nombre: 'stock_minimo',
            titulo: 'Productos con Stock Mínimo',
            sentenciaSQL: 'SELECT * FROM vw_ProductosStockMinimo',
            tipoReporte: 1, // Query/Vista
            idModulo: '2',
            moduloNombre: 'Inventario'
          }
        ]
      },
      {
        idModulo: '3',
        nombre: 'Compras',
        administrador: true,
        fechaRegistro: new Date(),
        fechaActualizacion: new Date(),
        usuario: 'admin',
        programa: 'GeneradorReportes',
        activo: true,
        reportes: [
          {
            idReporte: '5',
            nombre: 'compras_proveedor',
            titulo: 'Compras por Proveedor',
            sentenciaSQL: 'SELECT * FROM vw_ComprasProveedor WHERE IdEmpresa = @pIdEmpresa AND Fecha BETWEEN @pFechaInicial AND @pFechaFinal',
            tipoReporte: 1, // Query/Vista
            idModulo: '3',
            moduloNombre: 'Compras'
          },
          {
            idReporte: '6',
            nombre: 'resumen_saldo_inventario',
            titulo: 'Resumen Saldo Inventario',
            sentenciaSQL: 'Empresa.spReporte_ResumenSaldoInventario @pIdEmpresa, @pYY, @pMM, @pIdProducto=Null, @pIdBodega=Null, @pIdLote=Null',
            tipoReporte: 2, // Stored Procedure
            idModulo: '3',
            moduloNombre: 'Compras'
          },
          {
            idReporte: '7',
            nombre: 'cuentas_por_pagar',
            titulo: 'Reporte de Cuentas por Pagar',
            sentenciaSQL: 'SELECT * FROM vw_CuentasPorPagar WHERE IdEmpresa = @pIdEmpresa AND Estado = @pEstado',
            tipoReporte: 1, // Query/Vista
            idModulo: '3',
            moduloNombre: 'Compras'
          },
          {
            idReporte: '8',
            nombre: 'analisis_gastos',
            titulo: 'Análisis de Gastos Mensuales',
            sentenciaSQL: 'SELECT * FROM vw_AnalisisGastos WHERE Periodo BETWEEN @pFechaInicial AND @pFechaFinal',
            tipoReporte: 1, // Query/Vista
            idModulo: '3',
            moduloNombre: 'Compras'
          },
          {
            idReporte: '9',
            nombre: 'ordenes_compra',
            titulo: 'Órdenes de Compra Pendientes',
            sentenciaSQL: 'SELECT * FROM vw_OrdenesCompraPendientes WHERE IdEmpresa = @pIdEmpresa',
            tipoReporte: 1, // Query/Vista
            idModulo: '3',
            moduloNombre: 'Compras'
          },
          {
            idReporte: '10',
            nombre: 'evaluacion_proveedores',
            titulo: 'Evaluación de Proveedores',
            sentenciaSQL: 'Empresa.spEvaluacionProveedores @pIdEmpresa, @pPeriodo, @pTipoEvaluacion=Null',
            tipoReporte: 2, // Stored Procedure
            idModulo: '3',
            moduloNombre: 'Compras'
          },
          {
            idReporte: '11',
            nombre: 'presupuesto_vs_real',
            titulo: 'Presupuesto vs Real',
            sentenciaSQL: 'SELECT * FROM vw_PresupuestoVsReal WHERE Año = @pAño AND Mes = @pMes',
            tipoReporte: 1, // Query/Vista
            idModulo: '3',
            moduloNombre: 'Compras'
          }
        ]
      }
    ];
  }

  private getMockReportResult(): ReportResult {
    return {
      columns: ['Invoice Number', 'Order Date', 'Delivery Date', 'Sale Amount', 'Employee', 'City'],
      data: [
        { 'Invoice Number': '35703', 'Order Date': '4/10/2017', 'Delivery Date': '4/13/2017, 09:00', 'Sale Amount': '$11,800', 'Employee': 'Harv Mudd', 'City': 'Los Angeles, CA' },
        { 'Invoice Number': '35714', 'Order Date': '1/22/2017', 'Delivery Date': '1/27/2017, 09:00', 'Sale Amount': '$14,750', 'Employee': 'Harv Mudd', 'City': 'Las Vegas, NV' },
        { 'Invoice Number': '38466', 'Order Date': '3/1/2017', 'Delivery Date': '3/3/2017, 17:45', 'Sale Amount': '$7,800', 'Employee': 'Harv Mudd', 'City': 'Los Angeles, CA' },
        { 'Invoice Number': '39874', 'Order Date': '2/4/2017', 'Delivery Date': '2/10/2017, 15:00', 'Sale Amount': '$9,050', 'Employee': 'Harv Mudd', 'City': 'Las Vegas, NV' },
        { 'Invoice Number': '58292', 'Order Date': '5/13/2017', 'Delivery Date': '5/19/2017, 14:30', 'Sale Amount': '$13,500', 'Employee': 'Harv Mudd', 'City': 'Los Angeles, CA' },
        { 'Invoice Number': '42156', 'Order Date': '6/8/2017', 'Delivery Date': '6/12/2017, 11:00', 'Sale Amount': '$16,200', 'Employee': 'Sarah Connor', 'City': 'San Francisco, CA' },
        { 'Invoice Number': '47823', 'Order Date': '7/15/2017', 'Delivery Date': '7/20/2017, 16:30', 'Sale Amount': '$8,900', 'Employee': 'John Smith', 'City': 'Phoenix, AZ' },
        { 'Invoice Number': '51234', 'Order Date': '8/22/2017', 'Delivery Date': '8/25/2017, 10:15', 'Sale Amount': '$12,300', 'Employee': 'Maria Garcia', 'City': 'Denver, CO' },
        { 'Invoice Number': '56789', 'Order Date': '9/10/2017', 'Delivery Date': '9/14/2017, 13:45', 'Sale Amount': '$19,750', 'Employee': 'David Johnson', 'City': 'Seattle, WA' },
        { 'Invoice Number': '63421', 'Order Date': '10/5/2017', 'Delivery Date': '10/8/2017, 12:00', 'Sale Amount': '$15,400', 'Employee': 'Lisa Brown', 'City': 'Portland, OR' }
      ],
      parameters: [],
      totalRecords: 150
    };
  }

  // Modules
  getAllModules(): Observable<Module[]> {
    if (this.useMockData) {
      return of(this.getMockModules());
    }
    return this.http.get<Module[]>(`${this.apiUrl}/Modules`).pipe(
      catchError(error => {
        console.error('Error fetching modules:', error);
        return of(this.getMockModules());
      })
    );
  }

  getModuleById(id: string): Observable<Module> {
    return this.http.get<Module>(`${this.apiUrl}/Modules/${id}`).pipe(
      catchError(error => {
        console.error('Error fetching module:', error);
        throw error;
      })
    );
  }

  // Reports
  getAllReports(): Observable<Report[]> {
    return this.http.get<Report[]>(`${this.apiUrl}/Reports`).pipe(
      catchError(error => {
        console.error('Error fetching reports:', error);
        return of([]);
      })
    );
  }

  getReportById(id: string): Observable<Report> {
    return this.http.get<Report>(`${this.apiUrl}/Reports/${id}`).pipe(
      catchError(error => {
        console.error('Error fetching report:', error);
        throw error;
      })
    );
  }

  getReportsByModule(moduleId: string): Observable<Report[]> {
    return this.http.get<Report[]>(`${this.apiUrl}/Reports/module/${moduleId}`).pipe(
      catchError(error => {
        console.error('Error fetching reports by module:', error);
        return of([]);
      })
    );
  }

  getReportParameters(reportId: string): Observable<ReportParameter[]> {
    if (this.useMockData) {
      // Simular parámetros para algunos reportes
      if (reportId === '1' || reportId === '5') {
        return of([
          { name: 'pFechaInicial', dataType: 'DateTime', displayName: 'Fecha Inicial', isRequired: true, defaultValue: null },
          { name: 'pFechaFinal', dataType: 'DateTime', displayName: 'Fecha Final', isRequired: true, defaultValue: null }
        ]);
      } else if (reportId === '3') {
        return of([
          { name: 'pIdBodega', dataType: 'int', displayName: 'ID Bodega', isRequired: true, defaultValue: null }
        ]);
      } else if (reportId === '6') {
        // SP example: Empresa.spReporte_ResumenSaldoInventario @pIdEmpresa, @pYY, @pMM, @pIdProducto=Null, @pIdBodega=Null, @pIdLote=Null
        return of([
          { name: 'pIdEmpresa', dataType: 'Guid', displayName: 'ID Empresa', isRequired: true, defaultValue: null },
          { name: 'pYY', dataType: 'int', displayName: 'Año', isRequired: true, defaultValue: null },
          { name: 'pMM', dataType: 'int', displayName: 'Mes', isRequired: true, defaultValue: null },
          { name: 'pIdProducto', dataType: 'Guid', displayName: 'ID Producto', isRequired: false, defaultValue: null },
          { name: 'pIdBodega', dataType: 'Guid', displayName: 'ID Bodega', isRequired: false, defaultValue: null },
          { name: 'pIdLote', dataType: 'Guid', displayName: 'ID Lote', isRequired: false, defaultValue: null }
        ]);
      }
      return of([]);
    }
    return this.http.get<ReportParameter[]>(`${this.apiUrl}/Reports/${reportId}/parameters`).pipe(
      catchError(error => {
        console.error('Error fetching report parameters:', error);
        return of([]);
      })
    );
  }

  executeReport(request: ExecuteReportRequest): Observable<ReportResult> {
    if (this.useMockData) {
      return of(this.getMockReportResult());
    }

    console.log('Executing report with request:', request);
    
    return this.http.post<ReportResult>(`${this.apiUrl}/Reports/execute`, request).pipe(
      tap(response => {
        console.log('API Response received:', response);
      }),
      catchError(error => {
        if (this.isNoDataError(error)) {
          console.warn('API reported no data for the selected filters.', error);
          return of(this.createEmptyReportResult());
        }

        console.error('Error executing report via API:', error);
        return throwError(() => error);
      })
    );
  }

  analyzeParameters(sqlQuery: string): Observable<ReportParameter[]> {
    return this.http.post<ReportParameter[]>(`${this.apiUrl}/Reports/analyze-parameters`, JSON.stringify(sqlQuery), {
      headers: { 'Content-Type': 'application/json' }
    }).pipe(
      catchError(error => {
        console.error('Error analyzing parameters:', error);
        // Provide basic parameter analysis as fallback
        return of(this.fallbackParameterAnalysis(sqlQuery));
      })
    );
  }

  private fallbackParameterAnalysis(sqlQuery: string): ReportParameter[] {
    const parameters: ReportParameter[] = [];
    
    // Find SQL parameters like @ParameterName
    const paramMatches = sqlQuery.match(/@\w+/g);
    // Find optional parameters with =Null pattern
    const optionalMatches = sqlQuery.match(/@(\w+)\s*=\s*Null/gi);
    const optionalParamNames = new Set(
      (optionalMatches || []).map(match => match.match(/@(\w+)/i)?.[1]).filter(Boolean)
    );
    
    if (paramMatches) {
      paramMatches.forEach((match) => {
        const paramName = match.substring(1); // Remove @
        const lowerParamName = paramName.toLowerCase();
        
        // Skip if already processed
        if (parameters.some(p => p.name === paramName)) {
          return;
        }
        
        // Determine parameter type based on name patterns
        let dataType = 'string';
        let displayName = paramName;
        
        if (lowerParamName.includes('fecha') || lowerParamName.includes('date')) {
          dataType = 'DateTime';
          displayName = paramName.includes('Inicial') ? 'Fecha Inicial' : 
                       paramName.includes('Final') ? 'Fecha Final' : 
                       'Fecha';
        } else if (lowerParamName.includes('guid') || lowerParamName.includes('uuid') || lowerParamName.includes('uniqueidentifier') || lowerParamName.includes('idempresa') || lowerParamName.includes('empresaid')) {
          dataType = 'Guid';
          displayName = paramName.replace(/([A-Z])/g, ' $1').trim();
        } else if (lowerParamName.includes('id') || lowerParamName.includes('codigo')) {
          dataType = 'int';
          displayName = paramName.replace(/([A-Z])/g, ' $1').trim();
        }
        
        // Check if parameter is optional
        const isRequired = !optionalParamNames.has(paramName);
        
        parameters.push({
          name: paramName,
          dataType: dataType,
          displayName: displayName,
          isRequired: isRequired,
          defaultValue: null
        });
      });
    }
    
    return parameters;
  }

  // Export functionality
  exportToExcel(request: ExportRequest, filename: string): Observable<void> {
    return new Observable(observer => {
      this.http.post(`${this.apiUrl}/Export/Excel`, request, { 
        responseType: 'blob' 
      }).subscribe({
        next: (blob) => {
          saveAs(blob, filename);
          observer.next();
          observer.complete();
        },
        error: (error) => {
          console.error('Error exporting to Excel:', error);
          observer.error(error);
        }
      });
    });
  }

  private createEmptyReportResult(): ReportResult {
    return {
      data: [],
      columns: [],
      parameters: [],
      totalRecords: 0
    };
  }

  private isNoDataError(error: any): boolean {
    const status = error?.status;
    const responseText = typeof error?.error === 'string' ? error.error : '';
    const responseMessage = error?.error?.message ?? '';
    const combined = `${responseText} ${responseMessage} ${error?.message ?? ''}`.toLowerCase();

    if (status === 204) {
      return true;
    }

    const noDataPatterns = [
      'no existe información',
      'no existe informacion',
      'sin datos',
      'no data',
      'no records',
      'ningún registro',
      'ningun registro',
      'no se encontraron datos',
      '0 registros',
      '0 rows'
    ];

    return noDataPatterns.some(pattern => combined.includes(pattern));
  }
}
