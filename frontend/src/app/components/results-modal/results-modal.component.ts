import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { saveAs } from 'file-saver';
import {
  ColDef,
  FirstDataRenderedEvent,
  GridApi,
  GridReadyEvent,
  GridSizeChangedEvent
} from 'ag-grid-community';
import { ReportParameter } from '../../models/report.models';

export interface ResultsModalData {
  reportTitle: string;
  results: any[];
  columnDefs: ColDef[];
  parameters?: { [key: string]: any };
  reportParameters?: ReportParameter[];
}

type DensityMode = 'compact' | 'normal' | 'comfortable';
type ExportValueKind = 'number' | 'date' | 'boolean' | 'string';

interface ExportColumnDefinition {
  field: string;
  headerName: string;
}

interface ExportColumnProfile extends ExportColumnDefinition {
  valueKind: ExportValueKind;
  decimalPlaces: number;
  width: number;
}

interface ParsedExportValue {
  value: string | number | boolean | Date | null;
  kind: ExportValueKind | 'empty';
  decimalPlaces: number;
}

@Component({
  selector: 'app-results-modal',
  templateUrl: './results-modal.component.html',
  styleUrls: ['./results-modal.component.scss']
})
export class ResultsModalComponent {
  searchText = '';
  isExporting = false;
  displayedRowsCount = 0;

  private gridApi: GridApi | null = null;
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
    @Inject(MAT_DIALOG_DATA) public data: ResultsModalData,
    private snackBar: MatSnackBar
  ) {
    this.displayedRowsCount = Array.isArray(data.results) ? data.results.length : 0;
  }

  onClose(): void {
    this.dialogRef.close();
  }

  onModifyFilters(): void {
    this.dialogRef.close({ action: 'modify-filters' });
  }

  async onExportExcel(): Promise<void> {
    if (!this.hasResults || this.isExporting) {
      return;
    }

    const exportColumns = this.getExportColumns();
    const exportRows = this.getRowsForExport();

    if (exportColumns.length === 0) {
      this.snackBar.open('No hay columnas disponibles para exportar.', 'Cerrar', { duration: 3500 });
      return;
    }

    if (exportRows.length === 0) {
      this.snackBar.open('No hay registros visibles para exportar con los filtros actuales.', 'Cerrar', { duration: 4000 });
      return;
    }

    this.isExporting = true;

    try {
      const excelJSImport = await import('exceljs/dist/exceljs.min.js');
      const ExcelJS = excelJSImport.default ?? excelJSImport;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'oDres - Generador de Reportes';
      workbook.lastModifiedBy = 'oDres - Generador de Reportes';
      workbook.created = new Date();
      workbook.modified = new Date();

      const worksheet = workbook.addWorksheet(this.getWorksheetName(), {
        properties: { defaultRowHeight: 22 }
      });

      const profiles = this.buildColumnProfiles(exportColumns, exportRows);
      const headerRowIndex = 5;
      const dataStartRow = headerRowIndex + 1;

      this.renderTopSection(worksheet, exportColumns.length, exportRows.length);
      this.renderColumnHeaders(worksheet, headerRowIndex, exportColumns);
      this.renderDataRows(worksheet, dataStartRow, exportRows, profiles);
      this.applyWorksheetLayout(worksheet, headerRowIndex, exportColumns.length);

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob(
        [buffer],
        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
      );

      saveAs(blob, this.getExportFileName());
      this.snackBar.open(`Excel generado (${exportRows.length} registros).`, 'Cerrar', { duration: 3500 });
    } catch (error) {
      console.error('Excel export error:', error);
      this.snackBar.open('No fue posible generar el archivo Excel.', 'Cerrar', { duration: 4500 });
    } finally {
      this.isExporting = false;
    }
  }

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
    this.applyDensitySettings();
    this.updateDisplayedRowsCount();
  }

  onFirstDataRendered(_: FirstDataRenderedEvent): void {
    this.autoSizeColumns();
    this.updateDisplayedRowsCount();
  }

  onGridSizeChanged(_: GridSizeChangedEvent): void {
    this.autoSizeColumns();
  }

  onQuickFilter(): void {
    if (this.gridApi) {
      this.gridApi.setGridOption('quickFilterText', this.searchText);
      this.updateDisplayedRowsCount();
    }
  }

  onFilterChanged(): void {
    this.updateDisplayedRowsCount();
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

  private getExportColumns(): ExportColumnDefinition[] {
    if (this.gridApi) {
      const displayed = this.gridApi.getAllDisplayedColumns()
        .map((column) => column.getColDef())
        .filter((colDef) => typeof colDef.field === 'string' && colDef.field.length > 0)
        .map((colDef) => ({
          field: colDef.field as string,
          headerName: (colDef.headerName ?? colDef.field ?? '').toString()
        }));

      if (displayed.length > 0) {
        return displayed;
      }
    }

    return this.data.columnDefs
      .filter((colDef) => typeof colDef.field === 'string' && colDef.field.length > 0)
      .map((colDef) => ({
        field: colDef.field as string,
        headerName: (colDef.headerName ?? colDef.field ?? '').toString()
      }));
  }

  private getRowsForExport(): any[] {
    if (!this.gridApi) {
      return [...this.data.results];
    }

    const rows: any[] = [];
    this.gridApi.forEachNodeAfterFilterAndSort((node) => {
      if (node.data) {
        rows.push(node.data);
      }
    });
    return rows;
  }

  private buildColumnProfiles(columns: ExportColumnDefinition[], rows: any[]): ExportColumnProfile[] {
    return columns.map((column) => {
      const sampleValues = rows
        .slice(0, 200)
        .map((row) => row[column.field])
        .filter((value) => value !== null && value !== undefined && value !== '');

      const { valueKind, decimalPlaces } = this.inferColumnType(sampleValues);
      const width = this.estimateColumnWidth(column, rows, valueKind);

      return {
        ...column,
        valueKind,
        decimalPlaces,
        width
      };
    });
  }

  private inferColumnType(values: unknown[]): { valueKind: ExportValueKind; decimalPlaces: number } {
    let numericCount = 0;
    let dateCount = 0;
    let booleanCount = 0;
    let stringCount = 0;
    let maxDecimals = 0;

    for (const value of values) {
      const parsed = this.parseExportValue(value);

      if (parsed.kind === 'number') {
        numericCount += 1;
        maxDecimals = Math.max(maxDecimals, parsed.decimalPlaces);
      } else if (parsed.kind === 'date') {
        dateCount += 1;
      } else if (parsed.kind === 'boolean') {
        booleanCount += 1;
      } else if (parsed.kind === 'string') {
        stringCount += 1;
      }
    }

    const maxDetected = Math.max(numericCount, dateCount, booleanCount, stringCount);

    if (maxDetected === 0) {
      return { valueKind: 'string', decimalPlaces: 0 };
    }

    if (numericCount === maxDetected) {
      return { valueKind: 'number', decimalPlaces: Math.min(maxDecimals, 6) };
    }

    if (dateCount === maxDetected) {
      return { valueKind: 'date', decimalPlaces: 0 };
    }

    if (booleanCount === maxDetected) {
      return { valueKind: 'boolean', decimalPlaces: 0 };
    }

    return { valueKind: 'string', decimalPlaces: 0 };
  }

  private parseExportValue(value: unknown): ParsedExportValue {
    if (value === null || value === undefined || value === '') {
      return { value: null, kind: 'empty', decimalPlaces: 0 };
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return { value, kind: 'date', decimalPlaces: 0 };
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return {
        value,
        kind: 'number',
        decimalPlaces: this.countDecimalPlaces(value.toString())
      };
    }

    if (typeof value === 'boolean') {
      return { value, kind: 'boolean', decimalPlaces: 0 };
    }

    if (typeof value === 'string') {
      const text = value.trim();

      if (text.length === 0) {
        return { value: null, kind: 'empty', decimalPlaces: 0 };
      }

      const booleanValue = this.tryParseBoolean(text);
      if (booleanValue !== null) {
        return { value: booleanValue, kind: 'boolean', decimalPlaces: 0 };
      }

      const numeric = this.tryParseNumeric(text);
      if (numeric !== null) {
        return {
          value: numeric.value,
          kind: 'number',
          decimalPlaces: numeric.decimalPlaces
        };
      }

      const dateValue = this.tryParseDate(text);
      if (dateValue) {
        return { value: dateValue, kind: 'date', decimalPlaces: 0 };
      }

      return { value: text, kind: 'string', decimalPlaces: 0 };
    }

    return { value: String(value), kind: 'string', decimalPlaces: 0 };
  }

  private tryParseBoolean(value: string): boolean | null {
    const normalized = value.trim().toLowerCase();
    if (['true', 'si', 'sí', 'yes'].includes(normalized)) {
      return true;
    }
    if (['false', 'no'].includes(normalized)) {
      return false;
    }
    return null;
  }

  private tryParseNumeric(value: string): { value: number; decimalPlaces: number } | null {
    const compact = value.replace(/\s/g, '').replace(/[$€£]/g, '');
    const usPattern = /^-?\d{1,3}(,\d{3})*(\.\d+)?$/;
    const plainPattern = /^-?\d+(\.\d+)?$/;
    const euPattern = /^-?\d{1,3}(\.\d{3})*(,\d+)?$/;

    let normalized = '';

    if (usPattern.test(compact)) {
      normalized = compact.replace(/,/g, '');
    } else if (plainPattern.test(compact)) {
      normalized = compact;
    } else if (euPattern.test(compact)) {
      normalized = compact.replace(/\./g, '').replace(',', '.');
    } else {
      return null;
    }

    const numericValue = Number(normalized);
    if (!Number.isFinite(numericValue)) {
      return null;
    }

    return {
      value: numericValue,
      decimalPlaces: this.countDecimalPlaces(normalized)
    };
  }

  private tryParseDate(value: string): Date | null {
    if (!/[T:/-]/.test(value) && !value.includes(' ')) {
      return null;
    }

    const nativeDate = new Date(value);
    if (!Number.isNaN(nativeDate.getTime())) {
      return nativeDate;
    }

    const latinDateMatch = value.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    );

    if (!latinDateMatch) {
      return null;
    }

    const day = Number(latinDateMatch[1]);
    const month = Number(latinDateMatch[2]) - 1;
    const yearValue = Number(latinDateMatch[3]);
    const year = yearValue < 100 ? 2000 + yearValue : yearValue;
    const hour = Number(latinDateMatch[4] ?? '0');
    const minute = Number(latinDateMatch[5] ?? '0');
    const second = Number(latinDateMatch[6] ?? '0');

    const parsedDate = new Date(year, month, day, hour, minute, second);
    if (Number.isNaN(parsedDate.getTime())) {
      return null;
    }

    return parsedDate;
  }

  private countDecimalPlaces(value: string): number {
    const normalized = value.replace(/,/g, '.');
    const parts = normalized.split('.');
    if (parts.length < 2) {
      return 0;
    }
    return parts[1].length;
  }

  private estimateColumnWidth(
    column: ExportColumnDefinition,
    rows: any[],
    kind: ExportValueKind
  ): number {
    const base = Math.max(column.headerName.length + 3, 12);
    const previewValues = rows.slice(0, 100).map((row) => row[column.field]);
    const maxDataLength = previewValues.reduce((currentMax, value) => {
      if (value === null || value === undefined) {
        return currentMax;
      }
      return Math.max(currentMax, String(value).length + 2);
    }, 0);

    const widthByKind = kind === 'number' ? 14 : kind === 'date' ? 19 : base;
    return Math.min(Math.max(base, maxDataLength, widthByKind), 45);
  }

  private renderTopSection(worksheet: any, totalColumns: number, totalRows: number): void {
    const title = this.data.reportTitle?.trim() || 'Resultados del Reporte';
    const exportDate = new Date();
    const dateText = exportDate.toLocaleString('es-CO');
    const filterSummary = this.getFilterSummary();
    const sortSummary = this.getSortSummary();

    worksheet.mergeCells(1, 1, 1, totalColumns);
    const titleCell = worksheet.getCell(1, 1);
    titleCell.value = title;
    titleCell.font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };

    worksheet.mergeCells(2, 1, 2, totalColumns);
    const infoCell = worksheet.getCell(2, 1);
    infoCell.value = `Exportado: ${dateText} | Registros visibles: ${totalRows} | Registros totales: ${this.data.results.length}`;
    infoCell.font = { name: 'Calibri', size: 11, color: { argb: 'FF334155' } };
    infoCell.alignment = { horizontal: 'left', vertical: 'middle' };
    infoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };

    worksheet.mergeCells(3, 1, 3, totalColumns);
    const filterCell = worksheet.getCell(3, 1);
    filterCell.value = `Filtros: ${filterSummary} | Orden: ${sortSummary}`;
    filterCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF475569' } };
    filterCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    filterCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

    worksheet.getRow(1).height = 30;
    worksheet.getRow(2).height = 22;
    worksheet.getRow(3).height = 30;
  }

  private renderColumnHeaders(
    worksheet: any,
    headerRowIndex: number,
    columns: ExportColumnDefinition[]
  ): void {
    columns.forEach((column, index) => {
      const cell = worksheet.getCell(headerRowIndex, index + 1);
      cell.value = column.headerName;
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };
    });

    worksheet.getRow(headerRowIndex).height = 25;
  }

  private renderDataRows(
    worksheet: any,
    firstDataRowIndex: number,
    rows: any[],
    profiles: ExportColumnProfile[]
  ): void {
    rows.forEach((rowData, rowIndex) => {
      const excelRowIndex = firstDataRowIndex + rowIndex;
      const isEven = rowIndex % 2 === 0;

      profiles.forEach((profile, columnIndex) => {
        const cell = worksheet.getCell(excelRowIndex, columnIndex + 1);
        const parsed = this.parseExportValue(rowData[profile.field]);
        const cellValue = this.normalizeCellValue(parsed, profile);

        cell.value = cellValue;
        cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF1F2937' } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' }
        };

        if (profile.valueKind === 'number' && typeof cellValue === 'number') {
          const decimals = Math.max(profile.decimalPlaces, parsed.decimalPlaces);
          cell.numFmt = decimals > 0 ? `#,##0.${'0'.repeat(Math.min(decimals, 6))}` : '#,##0';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else if (profile.valueKind === 'date' && cellValue instanceof Date) {
          cell.numFmt = 'yyyy-mm-dd hh:mm';
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (profile.valueKind === 'boolean' && typeof cellValue === 'boolean') {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      });
    });
  }

  private normalizeCellValue(
    parsedValue: ParsedExportValue,
    profile: ExportColumnProfile
  ): string | number | boolean | Date | null {
    if (parsedValue.kind === 'empty') {
      return null;
    }

    if (profile.valueKind === 'number') {
      return parsedValue.kind === 'number' ? parsedValue.value : String(parsedValue.value ?? '');
    }

    if (profile.valueKind === 'date') {
      return parsedValue.kind === 'date' ? parsedValue.value : String(parsedValue.value ?? '');
    }

    if (profile.valueKind === 'boolean') {
      return parsedValue.kind === 'boolean' ? parsedValue.value : String(parsedValue.value ?? '');
    }

    return String(parsedValue.value ?? '');
  }

  private applyWorksheetLayout(
    worksheet: any,
    headerRowIndex: number,
    totalColumns: number
  ): void {
    worksheet.views = [{ state: 'frozen', ySplit: headerRowIndex }];
    worksheet.autoFilter = {
      from: { row: headerRowIndex, column: 1 },
      to: { row: headerRowIndex, column: totalColumns }
    };
  }

  private getFilterSummary(): string {
    const quickFilter = this.searchText.trim();
    const summaryItems: string[] = [];

    if (quickFilter.length > 0) {
      summaryItems.push(`Busqueda global "${quickFilter}"`);
    }

    if (!this.gridApi) {
      return summaryItems.length > 0 ? summaryItems.join('; ') : 'Sin filtros';
    }

    const filterModel = this.gridApi.getFilterModel() as Record<string, any>;
    const activeFields = Object.keys(filterModel);

    if (activeFields.length === 0) {
      return summaryItems.length > 0 ? summaryItems.join('; ') : 'Sin filtros';
    }

    const headerLookup = new Map(this.getExportColumns().map((column) => [column.field, column.headerName]));

    activeFields.forEach((field) => {
      const filterInfo = filterModel[field];
      const headerName = headerLookup.get(field) ?? field;
      summaryItems.push(`${headerName}: ${this.describeFilter(filterInfo)}`);
    });

    return summaryItems.join('; ');
  }

  private describeFilter(filterInfo: Record<string, any>): string {
    if (!filterInfo) {
      return 'filtro activo';
    }

    if (filterInfo['operator'] && filterInfo['condition1'] && filterInfo['condition2']) {
      const c1 = this.describeFilter(filterInfo['condition1']);
      const c2 = this.describeFilter(filterInfo['condition2']);
      return `${c1} ${filterInfo['operator']} ${c2}`;
    }

    const type = typeof filterInfo['type'] === 'string' ? filterInfo['type'] : null;

    if (Array.isArray(filterInfo['values']) && filterInfo['values'].length > 0) {
      return `${type ?? 'set'} [${filterInfo['values'].join(', ')}]`;
    }

    if (filterInfo['filterTo'] !== undefined && filterInfo['filter'] !== undefined) {
      return `${type ?? 'rango'} ${filterInfo['filter']} .. ${filterInfo['filterTo']}`;
    }

    if (filterInfo['dateFrom']) {
      return `${type ?? 'fecha'} ${filterInfo['dateFrom']}`;
    }

    if (filterInfo['filter'] !== undefined) {
      return `${type ?? 'valor'} ${filterInfo['filter']}`;
    }

    return 'filtro activo';
  }

  private getSortSummary(): string {
    if (!this.gridApi) {
      return 'Sin orden';
    }

    const sortedColumns = this.gridApi
      .getColumnState()
      .filter((columnState) => columnState.sort === 'asc' || columnState.sort === 'desc')
      .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));

    if (sortedColumns.length === 0) {
      return 'Sin orden';
    }

    const headerLookup = new Map(this.getExportColumns().map((column) => [column.field, column.headerName]));

    return sortedColumns
      .map((columnState) => {
        const columnName = headerLookup.get(columnState.colId) ?? columnState.colId;
        const direction = columnState.sort === 'asc' ? 'ASC' : 'DESC';
        return `${columnName} (${direction})`;
      })
      .join(', ');
  }

  private getWorksheetName(): string {
    const baseName = this.data.reportTitle?.trim() || 'Reporte';
    const sanitized = baseName.replace(/[\\/*?:[\]]/g, '');
    return sanitized.slice(0, 31) || 'Reporte';
  }

  private getExportFileName(): string {
    const baseName = (this.data.reportTitle?.trim() || 'Reporte')
      .replace(/[\\/*?:[\]]/g, '')
      .replace(/\s+/g, '_');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${baseName}_${timestamp}.xlsx`;
  }

  private updateDisplayedRowsCount(): void {
    if (!this.gridApi) {
      this.displayedRowsCount = this.data.results.length;
      return;
    }

    this.displayedRowsCount = this.gridApi.getDisplayedRowCount();
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
