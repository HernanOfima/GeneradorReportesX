import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridOptions, GridApi } from 'ag-grid-community';
import { ReportService } from '../../services/report.service';
import { Module, Report, ReportResult, ReportParameter, ExecuteReportRequest } from '../../models/report.models';
import { ParameterInputDialogComponent } from '../parameter-input-dialog/parameter-input-dialog.component';
import { ResultsModalComponent } from '../results-modal/results-modal.component';
import { NumericCellRendererComponent } from '../numeric-cell-renderer/numeric-cell-renderer.component';
import { NumberFormatUtil } from '../../utils/number-format.util';

@Component({
  selector: 'app-report-viewer',
  templateUrl: './report-viewer.component.html',
  styleUrls: ['./report-viewer.component.scss']
})
export class ReportViewerComponent implements OnInit {
  @ViewChild('agGrid') agGrid!: AgGridAngular;

  modules: Module[] = [];
  selectedModule: Module | null = null;
  reports: Report[] = [];
  selectedReport: Report | null = null;
  reportResult: ReportResult | null = null;
  loading = false;
  searchForm: FormGroup;
  lastUsedParameters: { [key: string]: any } = {};

  // AG Grid Configuration
  columnDefs: ColDef[] = [];
  rowData: any[] = [];
  gridOptions: GridOptions;
  defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 100,
    filterParams: {
      buttons: ['reset', 'apply'],
    }
  };

  constructor(
    private reportService: ReportService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    this.searchForm = this.fb.group({
      globalSearch: ['']
    });

    this.gridOptions = {
      pagination: true,
      paginationPageSize: 50,
      enableRangeSelection: true,
      rowSelection: 'multiple',
      suppressRowClickSelection: false,
      animateRows: true,
      defaultColDef: this.defaultColDef,
      onGridReady: (params: any) => {
        params.api.sizeColumnsToFit();
      },
      onGridSizeChanged: (params: any) => {
        params.api.sizeColumnsToFit();
      }
    };
  }

  ngOnInit(): void {
    this.loadModules();
    this.setupGlobalSearch();
  }

  private setupGlobalSearch(): void {
    this.searchForm.get('globalSearch')?.valueChanges.subscribe((value: string) => {
      if (this.agGrid?.api) {
        this.agGrid.api.setGridOption('quickFilterText', value);
      }
    });
  }

  loadModules(): void {
    this.loading = true;
    this.reportService.getAllModules().subscribe({
      next: (modules: Module[]) => {
        // Filter modules to only show those with reports
        this.modules = modules.filter(module => 
          module.reportes && module.reportes.length > 0
        );
        this.loading = false;
      },
      error: (error: any) => {
        this.showError('Error loading modules');
        this.loading = false;
      }
    });
  }

  onModuleSelect(module: Module): void {
    this.selectedModule = module;
    this.selectedReport = null;
    this.reportResult = null;
    this.clearGrid();
    
    // First try to get reports from API, fallback to embedded reports
    this.loadReportsForModule(module);
  }

  loadReportsForModule(module: Module): void {
    this.loading = true;
    
    // Try to get reports from API first
    this.reportService.getReportsByModule(module.idModulo).subscribe({
      next: (reports: Report[]) => {
        if (reports && reports.length > 0) {
          this.reports = reports;
        } else {
          // Fallback to embedded reports if API returns empty
          this.reports = module.reportes || [];
        }
        this.loading = false;
      },
      error: (error: any) => {
        console.warn('API call failed, using embedded reports:', error);
        // Fallback to embedded reports if API fails
        this.reports = module.reportes || [];
        this.loading = false;
      }
    });
  }

  onReportSelect(report: Report): void {
    this.selectedReport = report;
    this.reportResult = null;
    this.clearGrid();
    this.executeReport(report);
  }

  executeReport(report: Report): void {
    this.loading = true;
    
    // Analyze the SQL query to detect parameters dynamically
    this.reportService.analyzeParameters(report.sentenciaSQL).subscribe({
      next: (parameters: ReportParameter[]) => {
        if (parameters.length > 0) {
          // Show parameter input dialog
          this.showParameterDialog(report, parameters);
        } else {
          // Execute report without parameters
          this.runReport(report, {});
        }
        this.loading = false;
      },
      error: (error: any) => {
        console.warn('Error analyzing SQL parameters, falling back to static parameters');
        // Fallback to static parameters if analysis fails
        this.reportService.getReportParameters(report.idReporte).subscribe({
          next: (parameters: ReportParameter[]) => {
            if (parameters.length > 0) {
              this.showParameterDialog(report, parameters);
            } else {
              this.runReport(report, {});
            }
            this.loading = false;
          },
          error: (fallbackError: any) => {
            this.showError('Error getting report parameters');
            this.loading = false;
          }
        });
      }
    });
  }

  private showParameterDialog(report: Report, parameters: ReportParameter[], initialValues?: { [key: string]: any }): void {
    const dialogRef = this.dialog.open(ParameterInputDialogComponent, {
      width: '440px',
      maxWidth: '80vw',
      maxHeight: '80vh',
      panelClass: 'parameter-dialog-panel',
      data: {
        report: report,
        parameters: parameters,
        initialValues: initialValues
      }
    });

    dialogRef.afterClosed().subscribe((result: any) => {
      if (result) {
        this.runReport(report, result);
      }
    });
  }

  private runReport(report: Report, parameters: { [key: string]: any }): void {
    this.loading = true;
    
    // Store parameters for export functionality
    this.lastUsedParameters = parameters;
    
    const request: ExecuteReportRequest = {
      reportId: report.idReporte,
      parameters: parameters
    };

    this.reportService.executeReport(request).subscribe({
      next: (result: ReportResult) => {
        this.reportResult = result;
        this.loading = false;

        const hasData = Array.isArray(result.data) && result.data.length > 0;
        if (!hasData) {
          this.showInfo('Con los filtros registrados no existe información.');
          this.openResultsModal(report, result, parameters);
          return;
        }

        this.showSuccess(`Reporte "${report.titulo}" ejecutado exitosamente`);
        
        // Open results in a modal instead of inline display
        this.openResultsModal(report, result, parameters);
      },
      error: (error: any) => {
        if (this.isNoDataError(error)) {
          this.reportResult = {
            data: [],
            columns: [],
            parameters: [],
            totalRecords: 0
          };
          this.showInfo('Con los filtros registrados no existe información.');
        } else {
          this.showError('Error ejecutando el reporte');
        }
        this.loading = false;
      }
    });
  }

  private openResultsModal(report: Report, result: ReportResult, parameters: { [key: string]: any }): void {
    // Setup column definitions with numeric formatting
    const columnDefs = result.columns.map(column => {
      const baseColDef = {
        field: column,
        headerName: column,
        sortable: true,
        filter: true,
        resizable: true
      };

      // Check if this is a numeric column that should be formatted
      const sampleValues = result.data.slice(0, 10).map(row => row[column]);
      if (NumberFormatUtil.shouldFormatAsNumeric(column, sampleValues)) {
        return {
          ...baseColDef,
          cellRenderer: NumericCellRendererComponent,
          type: 'numericColumn',
          cellStyle: { textAlign: 'right' }
        };
      }

      return baseColDef;
    });

    const dialogRef = this.dialog.open(ResultsModalComponent, {
      width: '100vw',
      maxWidth: '100vw',
      height: '100vh',
      maxHeight: '100vh',
      position: { top: '0', left: '0' },
      panelClass: ['results-modal-panel', 'results-modal-fullscreen-panel'],
      data: {
        reportTitle: report.titulo,
        results: result.data,
        columnDefs: columnDefs,
        parameters: parameters,
        reportParameters: result.parameters
      }
    });

    dialogRef.afterClosed().subscribe((modalResult: any) => {
      if (modalResult?.action === 'modify-filters' && result.parameters?.length > 0) {
        this.showParameterDialog(report, result.parameters, parameters);
      }
    });
  }

  private setupGrid(result: ReportResult): void {
    // Setup column definitions
    this.columnDefs = result.columns.map(column => ({
      field: column,
      headerName: column,
      sortable: true,
      filter: true,
      resizable: true
    }));

    // Setup row data
    this.rowData = result.data;
  }

  private clearGrid(): void {
    this.columnDefs = [];
    this.rowData = [];
  }

  exportToExcel(): void {
    if (!this.selectedReport || !this.reportResult) {
      this.showError('No report data to export');
      return;
    }

    this.loading = true;
    const filename = `${this.selectedReport.titulo}_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    this.reportService.exportToExcel({
      reportId: this.selectedReport.idReporte,
      parameters: this.lastUsedParameters
    }, filename).subscribe({
      next: () => {
        this.showSuccess('Report exported successfully');
        this.loading = false;
      },
      error: (error: any) => {
        this.showError('Error exporting report');
        this.loading = false;
      }
    });
  }

  refreshReport(): void {
    if (this.selectedReport) {
      this.executeReport(this.selectedReport);
    }
  }

  private showSuccess(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: ['success-snackbar']
    });
  }

  private showError(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      panelClass: ['error-snackbar']
    });
  }

  private showInfo(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000
    });
  }

  private isNoDataError(error: any): boolean {
    const responseText = typeof error?.error === 'string' ? error.error : '';
    const responseMessage = error?.error?.message ?? '';
    const combined = `${responseText} ${responseMessage} ${error?.message ?? ''}`.toLowerCase();

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
