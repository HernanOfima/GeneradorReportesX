import {
  Component, OnInit, OnDestroy, AfterViewInit,
  ViewChild, ElementRef, TemplateRef, ViewEncapsulation, NgZone
} from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import jspreadsheet from 'jspreadsheet-ce';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

import { AnaliticaService } from '../../services/analitica.service';
import { OfimaFormulasPlugin } from '../../utils/ofima-formulas.plugin';
import {
  ContextoDatos, ParametrosSpreadsheet,
  PlantillaAnalitica, MESES
} from '../../models/analitica.models';

@Component({
  selector: 'app-analitica-spreadsheet',
  templateUrl: './analitica-spreadsheet.component.html',
  styleUrls: ['./analitica-spreadsheet.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class AnaliticaSpreadsheetComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('spreadsheetContainer') containerRef!: ElementRef;
  @ViewChild('formulaBarInput')      formulaBarInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('dialogoGuardar') dialogoGuardarTpl!: TemplateRef<any>;
  @ViewChild('dialogoPlantillas') dialogoPlantillasTpl!: TemplateRef<any>;

  // ── Estado ──────────────────────────────────────────────────────────
  calculando = false;
  contextoOk = false;
  totalCuentasContexto = 0;
  seleccion = '';
  formulaActiva = '';
  formulaBarValor = '';
  private selX = 0;
  private selY = 0;
  // ── Barra de fórmulas ─────────────────────────────────────────────
  modoFormula       = false; // punto de inserción activo (fórmula empieza con =)
  private fxFocused  = false; // el input de la barra tiene foco
  private fxEditX    = -1;   // celda home del lado derecho (donde vive la fórmula)
  private fxEditY    = -1;
  plantillaNombre = '';
  plantillaDescripcion = '';
  plantillaIdActual: string | undefined;
  plantillas: PlantillaAnalitica[] = [];
  meses = MESES;

  params: ParametrosSpreadsheet = {
    empresa: '',
    anio1: new Date().getFullYear(),
    anio2: new Date().getFullYear(),
    mesInicial: 1,
    mesFinal: new Date().getMonth() + 1,
    acumulado: 'A',
    nivel: 2
  };

  formulasReferencia = [
    { formula: '=NOMBRECTA("11")', descripcion: 'Nombre de la cuenta 11' },
    { formula: '=SALDOINICIAL("11")', descripcion: 'Saldo inicial del período' },
    { formula: '=SALDOFINAL("11")', descripcion: 'Saldo final del período' },
    { formula: '=DEBITO("11")', descripcion: 'Total débitos del período' },
    { formula: '=CREDITO("11")', descripcion: 'Total créditos del período' },
    { formula: '=SALDOCADENA("1,2,3","4","A","EMP",2023)', descripcion: 'Suma saldos de varias cuentas' },
  ];

  // ── Internos ─────────────────────────────────────────────────────────
  private spreadsheet: any = null;
  private dialogRef: MatDialogRef<any> | null = null;

  constructor(
    private analiticaService: AnaliticaService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.registrarPlugin();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.inicializarSpreadsheet(), 300);
  }

  ngOnDestroy(): void {
    if (this.containerRef?.nativeElement) {
      try { (jspreadsheet as any).destroy(this.containerRef.nativeElement); } catch { /* ignore */ }
    }
    OfimaFormulasPlugin.clearContexto();
  }

  // ── Registro de formulas OFIMA en jSpreadsheet ─────────────────────
  private registrarPlugin(): void {
    OfimaFormulasPlugin.registrar();
  }

  // ── Inicializar jSpreadsheet ──────────────────────────────────────
  private inicializarSpreadsheet(datosIniciales?: any[][], formato?: {
    style?: Record<string, string>;
    mergeCells?: Record<string, [number, number]>;
    colWidths?: (number | string)[];
    rowHeights?: string[];
  }): void {
    const contenedor = this.containerRef.nativeElement;

    try { (jspreadsheet as any).destroy(contenedor); } catch { /* ignore */ }
    this.spreadsheet = null;

    const datos = datosIniciales || this.plantillaVacia();

    const wrapper = contenedor.closest('.spreadsheet-wrapper') as HTMLElement;
    const wrapperH = wrapper?.clientHeight ?? 0;
    const wrapperW = wrapper?.clientWidth ?? 0;
    const h = `${Math.max(wrapperH, window.innerHeight - 300)}px`;
    const w = `${Math.max(wrapperW, window.innerWidth - 32)}px`;

    // En v5: toolbar en SpreadsheetOptions (top-level), datos en worksheets[]
    const hojas = (jspreadsheet as any)(contenedor, {
      toolbar: true,
      worksheets: [{
        data: datos,
        columns: this.columnasPorDefecto(formato?.colWidths),
        minDimensions: [10, 40],
        tableOverflow: true,
        tableWidth: w,
        tableHeight: h,
        defaultColWidth: 120,
        allowInsertRow: true,
        allowInsertColumn: true,
        allowDeleteRow: true,
        allowDeleteColumn: true,
        wordWrap: false,
        style: formato?.style ?? undefined,
        mergeCells: formato?.mergeCells ?? undefined,
        onselection: (instance: any, _x1: any, _y1: any, x2: any, y2: any) => {
          this.spreadsheet = instance ?? this.spreadsheet;
          this.runInAngular(() => {
            this.syncSelectionFromCoords(x2, y2, instance);
            if (this.modoFormula && this.fxEditX >= 0) {
              this.insertarReferencia(this.seleccion);
            }
          });
        },
        oneditionstart: (instance: any, _td: any, x: any, y: any) => {
          this.spreadsheet = instance ?? this.spreadsheet;
          this.runInAngular(() => {
            this.syncSelectionFromCoords(x, y, instance);
            if (this.formulaBarValor.startsWith('=')) {
              this.modoFormula = true;
              this.fxEditX = x;
              this.fxEditY = y;
            }
          });
        },
        oneditionend: (instance: any, _td: any, _x: any, _y: any, value: any) => {
          this.spreadsheet = instance ?? this.spreadsheet;
          this.runInAngular(() => {
            this.formulaBarValor = value != null ? String(value) : '';
            this.formulaActiva = this.formulaBarValor.startsWith('=') ? this.formulaBarValor : '';
            if (this.formulaBarInputRef?.nativeElement) {
              this.formulaBarInputRef.nativeElement.value = this.formulaBarValor;
            }
            this.modoFormula = false;
            this.fxEditX = -1;
            this.fxEditY = -1;
          });
        }
      }]
    });

    this.spreadsheet = Array.isArray(hojas) ? (hojas[0] ?? null) : null;
    this.inicializarBarraFormulaDesdeSeleccion();
  }

  private obtenerHojaActiva(): any | null {
    if (this.spreadsheet && typeof this.spreadsheet.getData === 'function') {
      return this.spreadsheet;
    }

    const hoja = this.containerRef?.nativeElement?.spreadsheet?.worksheets?.[0] ?? null;
    if (hoja && typeof hoja.getData === 'function') {
      this.spreadsheet = hoja;
      return hoja;
    }

    return null;
  }

  private runInAngular(fn: () => void): void {
    if (NgZone.isInAngularZone()) {
      fn();
      return;
    }
    this.ngZone.run(fn);
  }

  private syncSelectionFromCoords(x: number, y: number, worksheet?: any): void {
    this.selX = x;
    this.selY = y;
    this.seleccion = `${this.colIndexToLetter(x + 1)}${y + 1}`;

    if (this.modoFormula && this.fxEditX >= 0) {
      return;
    }

    const hoja = worksheet ?? this.obtenerHojaActiva();
    const raw = hoja?.getValueFromCoords(x, y, true);
    this.formulaBarValor = raw != null ? String(raw) : '';
    this.formulaActiva   = typeof raw === 'string' && raw.startsWith('=') ? raw : '';

    if (this.formulaBarInputRef?.nativeElement) {
      this.formulaBarInputRef.nativeElement.value = this.formulaBarValor;
    }
  }

  private inicializarBarraFormulaDesdeSeleccion(intentos: number = 12): void {
    const hoja = this.obtenerHojaActiva();
    if (hoja) {
      this.runInAngular(() => this.syncSelectionFromCoords(this.selX, this.selY, hoja));
      return;
    }

    if (intentos <= 0) {
      return;
    }

    setTimeout(() => this.inicializarBarraFormulaDesdeSeleccion(intentos - 1), 50);
  }

  // ── Layout de columnas por defecto ────────────────────────────────
  private columnasPorDefecto(colWidths?: (number | string)[]) {
    const base = [
      { title: 'Código',       width: 80,  align: 'center' },
      { title: 'Descripción',  width: 240 },
      { title: 'Saldo Inicial',width: 130, align: 'right', type: 'numeric', mask: '#.##0,00', decimal: ',' },
      { title: 'Débito',       width: 130, align: 'right', type: 'numeric', mask: '#.##0,00', decimal: ',' },
      { title: 'Crédito',      width: 130, align: 'right', type: 'numeric', mask: '#.##0,00', decimal: ',' },
      { title: 'Saldo Final',  width: 130, align: 'right', type: 'numeric', mask: '#.##0,00', decimal: ',' },
      { title: 'Col G', width: 100 },
      { title: 'Col H', width: 100 },
      { title: 'Col I', width: 100 },
      { title: 'Col J', width: 100 },
    ];
    if (colWidths?.length) {
      colWidths.forEach((w, i) => { if (base[i]) base[i].width = Number(w) || base[i].width; });
    }
    return base;
  }

  // ── Plantilla inicial con ejemplo de Balance Mensual ─────────────
  private plantillaVacia(): any[][] {
    const rows: any[][] = [];

    // Fila de título
    rows.push(['', 'BALANCE MENSUAL', '', '', '', '', '', '', '', '']);
    rows.push(['', '', '', '', '', '', '', '', '', '']);

    // Encabezados
    rows.push(['Código', 'Descripción', 'Saldo Inicial', 'Débito', 'Crédito', 'Saldo Final', '', '', '', '']);

    // Filas de cuentas — el usuario escribe los códigos en col A y las fórmulas en col B-F
    const cuentasEjemplo = ['1', '11', '13', '14', '2', '22', '3', '4', '5', '6'];
    cuentasEjemplo.forEach(cuenta => {
      rows.push([
        cuenta,
        `=NOMBRECTA("${cuenta}")`,
        `=SALDOINICIAL("${cuenta}")`,
        `=DEBITO("${cuenta}")`,
        `=CREDITO("${cuenta}")`,
        `=SALDOFINAL("${cuenta}")`,
        '', '', '', ''
      ]);
    });

    // Fila de totales
    rows.push(['', 'TOTALES', '=SUM(C4:C13)', '=SUM(D4:D13)', '=SUM(E4:E13)', '=SUM(F4:F13)', '', '', '', '']);

    // Filas vacías adicionales
    for (let i = 0; i < 20; i++) {
      rows.push(['', '', '', '', '', '', '', '', '', '']);
    }

    return rows;
  }

  // ── CALCULAR: carga contexto y recalcula ──────────────────────────
  calcular(): void {
    if (!this.params.empresa) {
      this.snackBar.open('Ingrese el código de empresa primero.', 'OK', { duration: 3000 });
      return;
    }

    // Extraer cuentas únicas de la columna A del spreadsheet
    const cuentas = this.extraerCuentasDelSpreadsheet();

    if (cuentas.length === 0) {
      this.snackBar.open('No se encontraron códigos de cuenta en la columna A.', 'OK', { duration: 3000 });
      return;
    }

    this.calculando = true;
    this.contextoOk = false;

    const request = {
      empresa: this.params.empresa,
      anio1: this.params.anio1,
      anio2: this.params.anio2,
      mesInicial: this.params.mesInicial,
      mesFinal: this.params.mesFinal,
      acumulado: this.params.acumulado,
      cuentas
    };

    this.analiticaService.cargarContexto(request).subscribe({
      next: (contexto: ContextoDatos) => {
        OfimaFormulasPlugin.setContexto(contexto);
        this.contextoOk = true;
        this.totalCuentasContexto = Object.keys(contexto.nombresCuentas).length;

        // Forzar recálculo: modificar una celda vacía y restaurar
        this.forzarRecalculo();

        this.calculando = false;
        this.snackBar.open(`✓ Contexto cargado: ${this.totalCuentasContexto} cuentas`, '', { duration: 2500 });
      },
      error: (err: any) => {
        this.calculando = false;
        console.error('Error cargando contexto:', err);
        this.snackBar.open('Error al cargar los datos del servidor.', 'OK', { duration: 4000 });
      }
    });
  }

  // ── Extrae códigos de cuenta de la columna A (índice 0) ───────────
  private extraerCuentasDelSpreadsheet(): string[] {
    const hoja = this.obtenerHojaActiva();
    if (!hoja) return [];

    const datos: any[][] = hoja.getData();
    const cuentasSet = new Set<string>();

    datos.forEach((fila: any[]) => {
      const val = fila[0];
      if (val && typeof val === 'string' && /^\d+$/.test(val.trim())) {
        cuentasSet.add(val.trim());
      }
    });

    return Array.from(cuentasSet);
  }

  // ── Forzar recálculo en jSpreadsheet ─────────────────────────────
  private forzarRecalculo(): void {
    const hoja = this.obtenerHojaActiva();
    if (!hoja) return;

    const datos: any[][] = hoja.getData();

    // Re-set todas las celdas con fórmulas para disparar recálculo
    datos.forEach((fila: any[], rowIdx: number) => {
      fila.forEach((valor: any, colIdx: number) => {
        if (typeof valor === 'string' && valor.startsWith('=')) {
          hoja.setValueFromCoords(colIdx, rowIdx, valor, true);
        }
      });
    });
  }

  // ── Commit desde la barra de fórmulas (Enter / blur fuera de la hoja) ──
  private obtenerCoordenadasObjetivoFormula(): { x: number; y: number } {
    return {
      x: this.fxEditX >= 0 ? this.fxEditX : this.selX,
      y: this.fxEditY >= 0 ? this.fxEditY : this.selY
    };
  }

  commitFormula(value: string): void {
    const hoja = this.obtenerHojaActiva();
    if (!hoja) return;
    const { x: tx, y: ty } = this.obtenerCoordenadasObjetivoFormula();
    const prev = hoja.getValueFromCoords(tx, ty, true);
    if (String(prev ?? '') !== value) {
      hoja.setValueFromCoords(tx, ty, value, true);
    }
    this.formulaBarValor = value;
    this.formulaActiva   = value.startsWith('=') ? value : '';
    this.modoFormula     = false;
    this.fxEditX         = -1;
    this.fxEditY         = -1;
  }

  // ── Handlers del <input> de la barra de fórmulas ────────────────────
  onFxFocus(): void {
    this.fxFocused = true;
    // Si el valor ya empieza con = al recibir foco, activar modo fórmula
    if (this.formulaBarValor.startsWith('=') && this.fxEditX < 0) {
      this.modoFormula = true;
      this.fxEditX     = this.selX;
      this.fxEditY     = this.selY;
    }
  }

  onFxInput(value: string): void {
    this.formulaBarValor = value;
    if (value.startsWith('=')) {
      this.modoFormula = true;
      if (this.fxEditX < 0) { this.fxEditX = this.selX; this.fxEditY = this.selY; }
    } else {
      this.modoFormula = false;
      this.fxEditX = -1;
      this.fxEditY = -1;
    }
  }

  onFxBlur(value: string): void {
    this.fxFocused = false;
    this.formulaBarValor = value;
    // Esperar a que onselection se procese antes de decidir si hay que commitear
    setTimeout(() => {
      if (!this.fxFocused) {
        // El foco no volvio a la barra (el usuario no hizo clic en una celda para
        // insertar referencia) → commitear y salir del modo fórmula
        this.commitFormula(this.formulaBarValor);
      }
    }, 120);
  }

  onFxKeydown(event: KeyboardEvent, value: string): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      this.commitFormula(value);
      this.formulaBarInputRef?.nativeElement?.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      const { x: tx, y: ty } = this.obtenerCoordenadasObjetivoFormula();
      const hoja = this.obtenerHojaActiva();
      const raw  = hoja?.getValueFromCoords(tx, ty, true);
      // Restaurar valor original
      this.modoFormula = false;
      this.fxEditX     = -1;
      this.fxEditY     = -1;
      this.formulaBarValor = raw != null ? String(raw) : '';
      this.formulaActiva = this.formulaBarValor.startsWith('=') ? this.formulaBarValor : '';
      if (this.formulaBarInputRef?.nativeElement) {
        this.formulaBarInputRef.nativeElement.value = this.formulaBarValor;
        this.formulaBarInputRef.nativeElement.blur();
      }
    }
  }

  // ── Insertar referencia de celda en la posición del cursor del input ──
  private insertarReferencia(ref: string): void {
    const input = this.formulaBarInputRef?.nativeElement;
    if (input) {
      const start = input.selectionStart ?? this.formulaBarValor.length;
      const end   = input.selectionEnd   ?? this.formulaBarValor.length;
      this.formulaBarValor =
        this.formulaBarValor.substring(0, start) +
        ref +
        this.formulaBarValor.substring(end);
      input.value = this.formulaBarValor;
      // Refocalizar el input y posicionar el cursor tras la referencia insertada
      setTimeout(() => {
        input.focus();
        const pos = start + ref.length;
        input.setSelectionRange(pos, pos);
      }, 10);
    } else {
      this.formulaBarValor += ref;
    }
  }

  // ── Copiar fórmula al portapapeles ───────────────────────────────
  copiarFormula(formula: string): void {
    navigator.clipboard.writeText(formula).then(() => {
      this.snackBar.open(`Copiado: ${formula}`, '', { duration: 1500 });
    });
  }

  // ── Exportar a Excel (.xlsx con estilos, merges y anchos) ──────────
  async exportarExcel(): Promise<void> {
    const hoja = this.obtenerHojaActiva();
    if (!hoja) return;

    this.snackBar.open('Generando Excel...', '', { duration: 3000 });

    try {
      const rawData  = hoja.getData()  as any[][];
      const numRows  = rawData.length;
      const numCols  = numRows > 0 ? rawData[0].length : 10;
      const estilos  = (hoja.getStyle()  as Record<string, string>)          || {};
      const merges   = (hoja.getMerge()  as Record<string, [number, number]>) || {};
      const anchos   = (hoja.getWidth()  as (number | string)[])              || [];
      const altos    = (hoja.getHeight() as string[])                         || [];
      const columnas = this.getWorksheetColumns(hoja);
      const headers  = this.getWorksheetHeaders(hoja, numCols);
      const incluirHeaders = headers.some(h => h.trim().length > 0);
      const rowOffset = incluirHeaders ? 1 : 0;

      const workbook = new ExcelJS.Workbook();
      workbook.creator  = 'Generador de Reportes X';
      workbook.created  = new Date();
      workbook.modified = new Date();

      const sheetName = (this.plantillaNombre || 'Analitica').substring(0, 31);
      const ws = workbook.addWorksheet(sheetName, {
        pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true }
      });

      for (let c = 0; c < numCols; c++) {
        ws.getColumn(c + 1).width = Math.max(6, Math.round(Number(anchos[c] || 100) / 7));
      }

      if (incluirHeaders) {
        for (let c = 0; c < numCols; c++) {
          const cell = ws.getCell(1, c + 1);
          cell.value = headers[c] ?? '';

          const headerDomCell = (hoja as any)?.headers?.[c] as HTMLElement | undefined;
          const headerCss = this.buildCssFromComputedStyle(headerDomCell);
          const { font, fill, alignment, border } = this.cssToExcelStyle(headerCss);

          if (font) cell.font = font;
          if (fill) cell.fill = fill;
          cell.alignment = {
            horizontal: 'center',
            vertical: 'middle',
            ...(alignment || {})
          } as any;
          if (border) cell.border = border;
        }

        const headerHeightPx = ((hoja as any)?.headers?.[0] as HTMLElement | undefined)?.offsetHeight ?? 0;
        if (headerHeightPx > 0) {
          ws.getRow(1).height = Math.round(headerHeightPx * 0.75);
        }
      }

      for (let r = 0; r < numRows; r++) {
        const px = Number(altos[r]);
        if (px > 0) ws.getRow(r + 1 + rowOffset).height = Math.round(px * 0.75);
      }

      Object.entries(merges).forEach(([ref, [cols, rows]]) => {
        if (cols <= 1 && rows <= 1) return;
        try {
          const colLetter = ref.replace(/\d/g, '');
          const rowNum    = parseInt(ref.replace(/\D/g, ''), 10);
          const colIdx    = this.colLetterToIndex(colLetter);
          const endLetter = this.colIndexToLetter(colIdx + cols - 1);
          const excelStartRow = rowNum + rowOffset;
          ws.mergeCells(`${colLetter}${excelStartRow}:${endLetter}${excelStartRow + rows - 1}`);
        } catch { /* ignore merge errors */ }
      });

      for (let r = 0; r < numRows; r++) {
        const excelRow = r + 1 + rowOffset;
        for (let c = 0; c < numCols; c++) {
          const colLetter = this.colIndexToLetter(c + 1);
          const originalRef = `${colLetter}${r + 1}`;
          const excelRef    = `${colLetter}${excelRow}`;
          const cell        = ws.getCell(excelRef);

          const rawValue       = hoja.getValueFromCoords(c, r, false);
          const displayedValue = hoja.getValueFromCoords(c, r, true);
          const columnConfig   = columnas[c];
          const excelValue = this.getExcelCellValue(rawValue, displayedValue, columnConfig);
          cell.value = excelValue;

          if (typeof excelValue === 'number') {
            const numFmt = this.convertJssMaskToExcelNumFmt(
              String(columnConfig?.mask ?? ''),
              String(columnConfig?.decimal ?? '')
            );
            if (numFmt) {
              cell.numFmt = numFmt;
            }
          }

          const cssInline = typeof estilos[originalRef] === 'string' ? estilos[originalRef] : '';
          const domCell = typeof hoja.getCellFromCoords === 'function'
            ? (hoja.getCellFromCoords(c, r) as HTMLElement | undefined)
            : undefined;
          const cssComputed = this.buildCssFromComputedStyle(domCell);
          const cssMerged = this.mergeCssStyles(cssComputed, cssInline);

          if (cssMerged) {
            const { font, fill, alignment, border } = this.cssToExcelStyle(cssMerged);
            if (font) cell.font = font;
            if (fill) cell.fill = fill;
            if (border) cell.border = border;

            const alignmentMerged: any = { ...(alignment || {}) };
            if (columnConfig?.wordWrap === true && alignmentMerged.wrapText == null) {
              alignmentMerged.wrapText = true;
            }
            if (columnConfig?.align && alignmentMerged.horizontal == null) {
              alignmentMerged.horizontal = columnConfig.align;
            }
            if (Object.keys(alignmentMerged).length > 0) {
              cell.alignment = alignmentMerged;
            }
          } else {
            const fallbackAlignment: any = {};
            if (columnConfig?.align) fallbackAlignment.horizontal = columnConfig.align;
            if (columnConfig?.wordWrap === true) fallbackAlignment.wrapText = true;
            if (Object.keys(fallbackAlignment).length > 0) {
              cell.alignment = fallbackAlignment;
            }
          }
        }
      }

      if (incluirHeaders) {
        ws.views = [{ state: 'frozen', ySplit: 1 }];
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const fileName = (this.plantillaNombre || 'analitica')
        .replace(/[\\/:*?"<>|]/g, '_').trim() || 'analitica';

      saveAs(
        new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }),
        `${fileName}.xlsx`
      );

      this.snackBar.open('Excel exportado correctamente', '', { duration: 3000 });

    } catch (err: any) {
      console.error('Error exportando Excel:', err);
      this.snackBar.open('Error al generar el archivo Excel', 'OK', { duration: 4000 });
    }
  }

  private getWorksheetColumns(hoja: any): any[] {
    const config = typeof hoja?.getConfig === 'function' ? hoja.getConfig() : null;
    return Array.isArray(config?.columns) ? config.columns : [];
  }

  private getWorksheetHeaders(hoja: any, numCols: number): string[] {
    let headers: string[] = [];
    try {
      const rawHeaders = hoja?.getHeaders?.(true);
      if (Array.isArray(rawHeaders)) {
        headers = rawHeaders.map((h: any) => (h != null ? String(h) : ''));
      } else if (typeof rawHeaders === 'string' && rawHeaders.length > 0) {
        headers = rawHeaders.split(';').map(h => h.trim());
      }
    } catch { /* ignore */ }

    if (headers.length === 0) {
      const columnas = this.getWorksheetColumns(hoja);
      headers = Array.from({ length: numCols }, (_, i) => {
        const title = columnas[i]?.title;
        return title != null && String(title).trim().length > 0
          ? String(title)
          : this.colIndexToLetter(i + 1);
      });
    }

    if (headers.length < numCols) {
      for (let i = headers.length; i < numCols; i++) {
        headers.push(this.colIndexToLetter(i + 1));
      }
    }

    return headers.slice(0, numCols);
  }

  private parseRenderedText(value: any): string {
    if (value == null) return '';
    const input = String(value);
    if (!/[<>]/.test(input)) return input.trim();

    const div = document.createElement('div');
    div.innerHTML = input;
    return (div.textContent || div.innerText || '').trim();
  }

  private tryParseLocaleNumber(value: string, decimalPreference?: string): number | null {
    let txt = (value || '').replace(/\u00A0/g, ' ').trim();
    if (!txt) return null;

    let negative = false;
    if (/^\(.*\)$/.test(txt)) {
      negative = true;
      txt = txt.slice(1, -1);
    }

    txt = txt.replace(/[^\d,.\-]/g, '');
    if (!txt || txt === '-' || txt === ',' || txt === '.') return null;

    const hasComma = txt.includes(',');
    const hasDot = txt.includes('.');
    let decimalSep = decimalPreference === ',' || decimalPreference === '.' ? decimalPreference : '';
    if (!decimalSep) {
      if (hasComma && hasDot) {
        decimalSep = txt.lastIndexOf(',') > txt.lastIndexOf('.') ? ',' : '.';
      } else if (hasComma) {
        decimalSep = ',';
      } else {
        decimalSep = '.';
      }
    }

    const thousandSep = decimalSep === ',' ? '.' : ',';
    txt = txt.split(thousandSep).join('');
    if (decimalSep !== '.') txt = txt.replace(decimalSep, '.');

    const normalized = txt.trim();
    if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;

    const num = Number(normalized);
    if (!Number.isFinite(num)) return null;
    return negative ? -Math.abs(num) : num;
  }

  private convertJssMaskToExcelNumFmt(mask: string, decimal: string): string {
    if (!mask || !mask.trim()) return '#,##0.00';

    let fmt = mask.trim();
    if (decimal === ',') {
      fmt = fmt.replace(/\./g, '{TH}').replace(/,/g, '.').replace(/\{TH\}/g, ',');
    }
    return fmt;
  }

  private getExcelCellValue(rawValue: any, displayedValue: any, columnConfig: any): string | number | null {
    if (rawValue == null || rawValue === '') {
      const renderedEmpty = this.parseRenderedText(displayedValue);
      return renderedEmpty ? renderedEmpty : null;
    }

    if (typeof rawValue === 'number') {
      return rawValue;
    }

    const renderedText = this.parseRenderedText(displayedValue);
    const rawText = this.parseRenderedText(rawValue);
    const isNumericColumn = String(columnConfig?.type ?? '').toLowerCase() === 'numeric';

    if (typeof rawValue === 'string' && rawValue.startsWith('=')) {
      const parsedFormula = this.tryParseLocaleNumber(renderedText, columnConfig?.decimal);
      return parsedFormula != null ? parsedFormula : (renderedText || rawText || null);
    }

    if (isNumericColumn) {
      const parsedNumeric = this.tryParseLocaleNumber(renderedText || rawText, columnConfig?.decimal);
      if (parsedNumeric != null) return parsedNumeric;
    }

    return rawText || renderedText || null;
  }

  private buildCssFromComputedStyle(element?: HTMLElement): string {
    if (!element) return '';
    const st = window.getComputedStyle(element);
    const keys = [
      'font-weight',
      'font-style',
      'text-decoration',
      'font-size',
      'font-family',
      'color',
      'background-color',
      'text-align',
      'vertical-align',
      'white-space',
      'border-top',
      'border-right',
      'border-bottom',
      'border-left'
    ];

    return keys
      .map(key => {
        const val = st.getPropertyValue(key);
        return val && val.trim() ? `${key}: ${val.trim()}` : '';
      })
      .filter(Boolean)
      .join('; ');
  }

  private mergeCssStyles(baseCss: string, overrideCss: string): string {
    const parts = [baseCss, overrideCss].map(v => (v || '').trim()).filter(Boolean);
    return parts.join('; ');
  }

  private cssToExcelStyle(css: string): { font: any; fill: any; alignment: any; border: any } {
    const font: any = {};
    const fill: any = {};
    const alignment: any = {};
    const border: any = {};

    css.split(';').map(p => p.trim()).filter(Boolean).forEach(prop => {
      const idx = prop.indexOf(':');
      if (idx === -1) return;
      const key = prop.substring(0, idx).trim().toLowerCase();
      const val = prop.substring(idx + 1).trim();
      const lc  = val.toLowerCase();

      switch (key) {
        case 'font-weight':
          if (lc === 'bold' || Number(lc) >= 700) font.bold = true;
          break;
        case 'font-style':
          if (lc === 'italic') font.italic = true;
          break;
        case 'text-decoration':
          if (lc.includes('underline'))    font.underline = true;
          if (lc.includes('line-through')) font.strike    = true;
          break;
        case 'color': {
          const argb = this.cssColorToArgb(lc);
          if (argb) font.color = { argb };
          break;
        }
        case 'background-color': {
          const argb = this.cssColorToArgb(lc);
          if (argb) { fill.type = 'pattern'; fill.pattern = 'solid'; fill.fgColor = { argb }; }
          break;
        }
        case 'font-size': {
          const sz = parseFloat(val);
          if (!isNaN(sz)) font.size = sz;
          break;
        }
        case 'font-family':
          font.name = val.split(',')[0].trim().replace(/[\'"/]/g, '');
          break;
        case 'text-align':
          if (['left', 'center', 'right', 'justify'].includes(lc)) alignment.horizontal = lc;
          break;
        case 'vertical-align':
          if (lc === 'middle') alignment.vertical = 'middle';
          else if (lc === 'top')    alignment.vertical = 'top';
          else if (lc === 'bottom') alignment.vertical = 'bottom';
          break;
        case 'white-space':
          if (lc.includes('pre') || lc.includes('normal')) alignment.wrapText = true;
          break;
        case 'border-top': {
          const top = this.cssBorderToExcelBorder(val);
          if (top) border.top = top;
          break;
        }
        case 'border-right': {
          const right = this.cssBorderToExcelBorder(val);
          if (right) border.right = right;
          break;
        }
        case 'border-bottom': {
          const bottom = this.cssBorderToExcelBorder(val);
          if (bottom) border.bottom = bottom;
          break;
        }
        case 'border-left': {
          const left = this.cssBorderToExcelBorder(val);
          if (left) border.left = left;
          break;
        }
      }
    });

    return {
      font:      Object.keys(font).length      ? font      : null,
      fill:      Object.keys(fill).length      ? fill      : null,
      alignment: Object.keys(alignment).length ? alignment : null,
      border:    Object.keys(border).length    ? border    : null,
    };
  }

  private cssBorderToExcelBorder(borderCss: string): { style: string; color?: { argb: string } } | null {
    const value = (borderCss || '').trim().toLowerCase();
    if (!value || value === 'none' || value === '0' || value.includes('none')) return null;

    const widthMatch = value.match(/(\d+(\.\d+)?)px/);
    const width = widthMatch ? Number(widthMatch[1]) : 1;
    let style: string = 'thin';

    if (value.includes('dashed')) style = 'dashed';
    else if (value.includes('dotted')) style = 'dotted';
    else if (value.includes('double')) style = 'double';
    else if (width >= 3) style = 'thick';
    else if (width >= 2) style = 'medium';

    const colorPart = value.match(/(rgba?\([^)]+\)|#[0-9a-f]{3,8}|[a-z]+)/i)?.[1] || '';
    const argb = this.cssColorToArgb(colorPart);
    if (argb) {
      return { style, color: { argb } };
    }
    return { style };
  }

  private cssColorToArgb(color: string): string {
    if (!color) return '';
    const c = color.trim().toLowerCase();
    if (!c || ['transparent', 'inherit', 'initial', 'unset', 'none'].includes(c)) return '';

    if (c.startsWith('#')) {
      const h = c.slice(1);
      if (h.length === 8) return h.toUpperCase();
      const full = h.length === 3 ? h.split('').map(v => v + v).join('') : h.padEnd(6, '0');
      return ('FF' + full).toUpperCase();
    }

    const rgb = c.match(/rgb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)/);
    if (rgb) {
      return ('FF' +
        parseInt(rgb[1], 10).toString(16).padStart(2, '0') +
        parseInt(rgb[2], 10).toString(16).padStart(2, '0') +
        parseInt(rgb[3], 10).toString(16).padStart(2, '0')
      ).toUpperCase();
    }

    const rgba = c.match(/rgba\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*([0-9.]+)\s*\)/);
    if (rgba) {
      const alpha = Math.max(0, Math.min(1, Number(rgba[4])));
      if (alpha <= 0) return '';
      const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
      return (a +
        parseInt(rgba[1], 10).toString(16).padStart(2, '0') +
        parseInt(rgba[2], 10).toString(16).padStart(2, '0') +
        parseInt(rgba[3], 10).toString(16).padStart(2, '0')
      ).toUpperCase();
    }

    const named: Record<string, string> = {
      black: 'FF000000',
      white: 'FFFFFFFF',
      red: 'FFFF0000',
      green: 'FF008000',
      blue: 'FF0000FF',
      gray: 'FF808080',
      grey: 'FF808080',
      yellow: 'FFFFFF00'
    };
    if (named[c]) return named[c];

    return '';
  }
  private colLetterToIndex(col: string): number {
    return col.toUpperCase().split('').reduce((acc, c) => acc * 26 + c.charCodeAt(0) - 64, 0);
  }

  // ── Índice base 1 → letra(s) de columna (1→"A", 27→"AA") ─────────
  private colIndexToLetter(index: number): string {
    let result = '';
    while (index > 0) {
      result = String.fromCharCode(64 + ((index - 1) % 26 + 1)) + result;
      index  = Math.floor((index - 1) / 26);
    }
    return result;
  }

  // ── Guardar plantilla ────────────────────────────────────────────
  guardarPlantilla(): void {
    this.dialogRef = this.dialog.open(this.dialogoGuardarTpl, { width: '420px' });

    this.dialogRef.afterClosed().subscribe((confirmar: boolean) => {
      if (!confirmar || !this.plantillaNombre) return;

      const hoja = this.obtenerHojaActiva();
      const datos   = hoja?.getData()    ?? [];
      const estilos  = hoja?.getStyle()   ?? {};
      const merges   = hoja?.getMerge()   ?? {};
      const anchos   = hoja?.getWidth()   ?? [];
      const altos    = hoja?.getHeight()  ?? [];

      // Filtrar estilos vacíos para mantener el JSON compacto
      const stylesFiltrados: Record<string, string> = {};
      Object.entries(estilos as Record<string, string>).forEach(([k, v]) => {
        if (v && v.trim()) stylesFiltrados[k] = v;
      });

      const contenido = JSON.stringify({
        version: 2,
        data: datos,
        style: stylesFiltrados,
        mergeCells: merges,
        colWidths: anchos,
        rowHeights: altos,
        params: this.params,
        timestamp: new Date().toISOString()
      });

      this.analiticaService.guardarPlantilla({
        id: this.plantillaIdActual,
        nombre: this.plantillaNombre,
        descripcion: this.plantillaDescripcion,
        contenido
      }).subscribe({
        next: (p: PlantillaAnalitica) => {
          this.plantillaIdActual = p.id;
          this.snackBar.open(`✓ Plantilla "${p.nombre}" guardada`, '', { duration: 3000 });
        },
        error: () => this.snackBar.open('Error al guardar la plantilla', 'OK', { duration: 3000 })
      });
    });
  }

  // ── Abrir diálogo de plantillas ───────────────────────────────────
  abrirDialogoPlantillas(): void {
    this.analiticaService.getPlantillas().subscribe((lista: PlantillaAnalitica[]) => {
      this.plantillas = lista;
      this.dialogRef = this.dialog.open(this.dialogoPlantillasTpl, { width: '520px', maxHeight: '70vh' });
    });
  }

  // ── Cargar plantilla ─────────────────────────────────────────────
  cargarPlantilla(plantilla: PlantillaAnalitica): void {
    this.dialogRef?.close();

    try {
      const parsed = JSON.parse(plantilla.contenido);
      this.plantillaIdActual = plantilla.id;
      this.plantillaNombre = plantilla.nombre;
      this.plantillaDescripcion = plantilla.descripcion;

      if (parsed.params) {
        this.params = { ...this.params, ...parsed.params };
      }

      if (parsed.data && Array.isArray(parsed.data)) {
        this.inicializarSpreadsheet(parsed.data, {
          style:      parsed.style      ?? undefined,
          mergeCells: parsed.mergeCells ?? undefined,
          colWidths:  parsed.colWidths  ?? undefined,
          rowHeights: parsed.rowHeights ?? undefined,
        });
      }

      this.snackBar.open(`✓ Plantilla "${plantilla.nombre}" cargada`, '', { duration: 2500 });
    } catch {
      this.snackBar.open('Error al cargar la plantilla', 'OK', { duration: 3000 });
    }
  }

  // ── Eliminar plantilla ───────────────────────────────────────────
  eliminarPlantilla(id: string): void {
    this.analiticaService.eliminarPlantilla(id).subscribe({
      next: () => {
        this.plantillas = this.plantillas.filter(p => p.id !== id);
        this.snackBar.open('Plantilla eliminada', '', { duration: 2000 });
      },
      error: () => this.snackBar.open('Error al eliminar', 'OK', { duration: 3000 })
    });
  }
}
