import {
  Component, OnInit, OnDestroy, AfterViewInit,
  ViewChild, ElementRef, TemplateRef, ViewEncapsulation
} from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import jspreadsheet from 'jspreadsheet-ce';

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
    private snackBar: MatSnackBar
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
        onselection: (_el: any, _x1: any, _y1: any, x2: any, y2: any) => {
          this.selX = x2;
          this.selY = y2;
          const col = String.fromCharCode(65 + x2);
          this.seleccion = `${col}${y2 + 1}`;
          const raw = this.spreadsheet?.getValueFromCoords(x2, y2, true);
          this.formulaBarValor = raw != null ? String(raw) : '';
          this.formulaActiva = typeof raw === 'string' && raw.startsWith('=') ? raw : '';
        },
        oneditionstart: (_el: any, _td: any, x: any, y: any) => {
          const raw = this.spreadsheet?.getValueFromCoords(x, y, true);
          this.formulaBarValor = raw != null ? String(raw) : '';
        },
        oneditionend: (_el: any, _td: any, x: any, y: any, value: any) => {
          this.formulaBarValor = value != null ? String(value) : '';
        }
      }]
    });

    this.spreadsheet = Array.isArray(hojas) ? (hojas[0] ?? null) : null;
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

  // ── Commit desde la barra de fórmulas ────────────────────────────
  commitFormula(value: string): void {
    const hoja = this.obtenerHojaActiva();
    if (!hoja) return;
    const prev = hoja.getValueFromCoords(this.selX, this.selY, true);
    if (String(prev ?? '') === value) return;         // sin cambios
    hoja.setValueFromCoords(this.selX, this.selY, value, true);
    this.formulaBarValor = value;
    this.formulaActiva = value.startsWith('=') ? value : '';
  }

  // ── Copiar fórmula al portapapeles ───────────────────────────────
  copiarFormula(formula: string): void {
    navigator.clipboard.writeText(formula).then(() => {
      this.snackBar.open(`Copiado: ${formula}`, '', { duration: 1500 });
    });
  }

  // ── Exportar a Excel ─────────────────────────────────────────────
  exportarExcel(): void {
    const hoja = this.obtenerHojaActiva();
    if (!hoja) return;
    hoja.download();
    this.snackBar.open('Exportando a Excel...', '', { duration: 2000 });
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



