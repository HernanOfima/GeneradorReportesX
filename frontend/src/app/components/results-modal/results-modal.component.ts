import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ColDef, GridApi } from 'ag-grid-community';
import { ReportParameter } from '../../models/report.models';

export interface ResultsModalData {
  reportTitle: string;
  results: any[];
  columnDefs: ColDef[];
  parameters?: { [key: string]: any };
  reportParameters?: ReportParameter[];
}

type DensityMode = 'compact' | 'normal' | 'comfortable';

@Component({
  selector: 'app-results-modal',
  templateUrl: './results-modal.component.html',
  styleUrls: ['./results-modal.component.scss']
})
export class ResultsModalComponent {
  searchText = '';
  private gridApi!: GridApi;
  densityMode: DensityMode = 'normal';

  private readonly densityConfig: Record<DensityMode, { rowHeight: number; headerHeight: number; fontSize: number; paginationPageSize: number; minWidth: number; }> = {
    compact: { rowHeight: 42, headerHeight: 48, fontSize: 13, paginationPageSize: 30, minWidth: 115 },
    normal: { rowHeight: 50, headerHeight: 56, fontSize: 15, paginationPageSize: 25, minWidth: 130 },
    comfortable: { rowHeight: 58, headerHeight: 64, fontSize: 16, paginationPageSize: 20, minWidth: 145 }
  };

  gridOptions = {
    defaultColDef: {
      sortable: true,
      filter: true,
      resizable: true,
      minWidth: 130
    },
    rowHeight: 50,
    headerHeight: 56,
    pagination: true,
    paginationPageSize: 25,
    animateRows: true,
    enableRangeSelection: true,
    suppressColumnVirtualisation: true
  };

  constructor(
    public dialogRef: MatDialogRef<ResultsModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ResultsModalData
  ) {}

  onClose(): void {
    this.dialogRef.close();
  }

  onModifyFilters(): void {
    this.dialogRef.close({ action: 'modify-filters' });
  }

  onExportExcel(): void {
    if (!this.hasResults) {
      return;
    }

    // Simple CSV export as fallback since XLSX is not available
    const headers = this.data.columnDefs.map(col => col.field || col.headerName || '').join(',');
    const rows = this.data.results.map(row => 
      this.data.columnDefs.map(col => {
        const field = col.field || '';
        return row[field] || '';
      }).join(',')
    ).join('\n');
    
    const csvContent = headers + '\n' + rows;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.data.reportTitle}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  onGridReady(event: any): void {
    this.gridApi = event.api;
    this.applyDensitySettings();
  }

  onFirstDataRendered(): void {
    this.autoSizeColumns();
  }

  onGridSizeChanged(): void {
    this.autoSizeColumns();
  }

  onQuickFilter(): void {
    if (this.gridApi) {
      this.gridApi.setGridOption('quickFilterText', this.searchText);
    }
  }

  get hasResults(): boolean {
    return Array.isArray(this.data.results) && this.data.results.length > 0;
  }

  get canModifyFilters(): boolean {
    return Array.isArray(this.data.reportParameters) && this.data.reportParameters.length > 0;
  }

  setDensity(mode: DensityMode): void {
    if (this.densityMode === mode) {
      return;
    }

    this.densityMode = mode;
    this.applyDensitySettings();
  }

  get densityClass(): string {
    return `density-${this.densityMode}`;
  }

  private applyDensitySettings(): void {
    if (!this.gridApi) {
      return;
    }

    const density = this.densityConfig[this.densityMode];
    this.gridApi.setGridOption('rowHeight', density.rowHeight);
    this.gridApi.setGridOption('headerHeight', density.headerHeight);
    this.gridApi.setGridOption('paginationPageSize', density.paginationPageSize);
    this.gridApi.setGridOption('defaultColDef', {
      ...this.gridOptions.defaultColDef,
      minWidth: density.minWidth
    });

    this.gridApi.resetRowHeights();
    this.gridApi.refreshHeader();
    this.autoSizeColumns();
  }

  private autoSizeColumns(): void {
    if (!this.gridApi || !this.hasResults) {
      return;
    }

    const allColumns = this.gridApi.getColumns() ?? [];
    if (allColumns.length === 0) {
      return;
    }

    const columnIds = allColumns.map(column => column.getColId());
    (this.gridApi as any).autoSizeColumns?.(columnIds, false);
  }
}
