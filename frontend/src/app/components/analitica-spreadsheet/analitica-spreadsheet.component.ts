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
  CargarContextoRequest, ContextoDatos, ParametrosSpreadsheet,
  PlantillaAnalitica, MESES
} from '../../models/analitica.models';

type FormulaCalcState = 'idle' | 'editing' | 'calculating' | 'ready' | 'error';

interface FormulaBarToken {
  text: string;
  color?: string;
}

interface FormulaReference {
  key: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
}

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

  // â”€â”€ Estado â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  calculando = false;
  contextoOk = false;
  totalCuentasContexto = 0;
  seleccion = '';
  formulaActiva = '';
  formulaBarValor = '';
  formulaBarTokens: FormulaBarToken[] = [];
  calcState: FormulaCalcState = 'idle';
  calcStateDetalle = 'Listo';
  calcChainLength = 0;
  private selX = 0;
  private selY = 0;
  // â”€â”€ Barra de fÃ³rmulas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  modoFormula       = false; // punto de inserciÃ³n activo (fÃ³rmula empieza con =)
  private fxFocused  = false; // el input de la barra tiene foco
  private fxEditX    = -1;   // celda home del lado derecho (donde vive la fÃ³rmula)
  private fxEditY    = -1;
  plantillaNombre = '';
  plantillaDescripcion = '';
  plantillaSeleccionadaNombre = '';
  plantillaIdActual: string | undefined;
  plantillas: PlantillaAnalitica[] = [];
  meses = MESES;

  private readonly allParamKeys: (keyof ParametrosSpreadsheet)[] = [
    'idEmpresa', 'anio1', 'anio2', 'mesInicial', 'mesFinal', 'acumulado', 'nivel'
  ];

  private readonly defaultParams: Required<Pick<
    ParametrosSpreadsheet,
    'idEmpresa' | 'anio1' | 'anio2' | 'mesInicial' | 'mesFinal' | 'acumulado' | 'nivel'
  >> = {
    idEmpresa: '',
    anio1: new Date().getFullYear(),
    anio2: new Date().getFullYear(),
    mesInicial: 1,
    mesFinal: new Date().getMonth() + 1,
    acumulado: 'A',
    nivel: 2
  };
  params: ParametrosSpreadsheet = { ...this.defaultParams };
  // Campos visibles en el panel de parÃ¡metros (dinÃ¡mico segÃºn la plantilla)
  paramsCampos = new Set<keyof ParametrosSpreadsheet>(this.allParamKeys);

  formulasReferencia = [
    { formula: '=NOMBRECTA("11")', descripcion: 'Nombre de la cuenta 11' },
    { formula: '=SALDOINICIAL("11")', descripcion: 'Saldo inicial del perÃ­odo' },
    { formula: '=SALDOFINAL("11")', descripcion: 'Saldo final del perÃ­odo' },
    { formula: '=DEBITO("11")', descripcion: 'Total dÃ©bitos del perÃ­odo' },
    { formula: '=CREDITO("11")', descripcion: 'Total crÃ©ditos del perÃ­odo' },
    { formula: '=SALDOCADENA("1,2,3","4","A","EMP",2023)', descripcion: 'Suma saldos de varias cuentas' },
  ];

  // â”€â”€ Internos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  private spreadsheet: any = null;
  private dialogRef: MatDialogRef<any> | null = null;
  private readonly formulaRefPalette: string[] = ['#2f7df6', '#e25555', '#8b5cf6', '#2ba84a', '#f59e0b', '#06b6d4'];
  private formulaRefs: FormulaReference[] = [];
  private highlightedFormulaCells: HTMLElement[] = [];
  private activeCellEditor: HTMLInputElement | HTMLTextAreaElement | null = null;
  private cellEditorInputHandler: (() => void) | null = null;
  private formulaModeClickHandler: ((e: MouseEvent) => void) | null = null;

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
    this.detachCellEditorListener();
    this.detachFormulaModeClickHandler();
    this.clearFormulaHighlights();
    OfimaFormulasPlugin.clearContexto();
  }

  mostrarCampo(campo: keyof ParametrosSpreadsheet): boolean {
    return this.paramsCampos.has(campo);
  }

  get tienePlantillaSeleccionada(): boolean {
    return !!this.plantillaSeleccionadaNombre?.trim();
  }

  get plantillaActivaTexto(): string {
    return this.tienePlantillaSeleccionada
      ? this.plantillaSeleccionadaNombre
      : 'Sin plantilla seleccionada';
  }

  get esModoOscuro(): boolean {
    return this.estaModoOscuro();
  }

  get mostrarFormulaPreview(): boolean {
    return this.modoFormula && this.formulaBarValor.startsWith('=');
  }

  get formulaBarCeldaActiva(): string {
    if (this.fxEditX >= 0 && this.fxEditY >= 0) {
      return `${this.colIndexToLetter(this.fxEditX + 1)}${this.fxEditY + 1}`;
    }
    return this.seleccion || 'A1';
  }

  get calcStateTexto(): string {
    const chainInfo = this.calcChainLength > 0 ? ` (${this.calcChainLength})` : '';
    switch (this.calcState) {
      case 'editing':
        return 'Editando formula';
      case 'calculating':
        return 'Calculando' + chainInfo;
      case 'ready':
        return 'Listo' + chainInfo;
      case 'error':
        return 'Error';
      default:
        return 'En espera';
    }
  }

  get contextoDetalle(): string {
    const partes: string[] = [];

    if (this.mostrarCampo('idEmpresa') && this.params.idEmpresa) {
      partes.push(`Empresa: ${this.params.idEmpresa.slice(0, 8)}...`);
    }

    if (this.mostrarCampo('mesInicial')) {
      const mesInicial = this.obtenerNombreMes(this.params.mesInicial);
      const mesFinal = this.mostrarCampo('mesFinal')
        ? this.obtenerNombreMes(this.params.mesFinal)
        : mesInicial;
      partes.push(`Periodo: ${mesInicial}-${mesFinal}`);
    }

    if (this.mostrarCampo('anio1')) {
      const anio1 = this.params.anio1 ?? this.defaultParams.anio1;
      const anio2 = this.mostrarCampo('anio2')
        ? (this.params.anio2 ?? anio1)
        : anio1;
      partes.push(`Anios: ${anio1}/${anio2}`);
    }

    return partes.join(' | ');
  }

  private obtenerNombreMes(mes?: number): string {
    const encontrado = this.meses.find(m => m.value === mes);
    return encontrado?.label ?? String(mes ?? '');
  }

  // â”€â”€ Registro de formulas OFIMA en jSpreadsheet â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  private registrarPlugin(): void {
    OfimaFormulasPlugin.registrar();
  }

  // â”€â”€ Inicializar jSpreadsheet â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // En CE v5: toolbar en SpreadsheetOptions (top-level), datos en worksheets[].
    // Nota: jspreadsheet.calculations(...) es de versiones mas nuevas (v10+),
    // aqui se mantiene como no-op seguro por compatibilidad futura.
    const jssAny = jspreadsheet as any;
    try {
      jssAny.calculations?.(false);
      this.setCalcState('calculating', 'Inicializando formulas');
    } catch { /* ignore */ }

    let hojas: any;
    try {
      hojas = jssAny(contenedor, {
        toolbar: true,
        // -- Eventos a nivel top-level (v5 CE dispatch los busca aqui) --
        onbeforeformula: (_ws: any, expression: string, _x: number, _y: number) => {
          this.runInAngular(() => this.setCalcState('calculating', expression || 'Formula'));
          return expression;
        },
        onbeforechange: (_ws: any, _cell: HTMLElement, _x: number, _y: number, value: any) =>
          this.normalizarValorFechaParaCelda(value),
        onchange: (instance: any, _cell: HTMLElement, x: number, y: number, newValue: any) => {
          this.spreadsheet = instance ?? this.spreadsheet;
          this.runInAngular(() => {
            this.syncSelectionFromCoords(x, y, instance);
            this.formulaBarValor = newValue != null ? String(newValue) : '';
            this.actualizarFormulaDecoracion();
          });
        },
        onafterchanges: (_ws: any, _records: any[], _origin: string) => {
          this.runInAngular(() => this.setCalcState('ready', 'Cambios aplicados'));
        },
        onselection: (instance: any, _x1: any, _y1: any, x2: any, y2: any) => {
          this.spreadsheet = instance ?? this.spreadsheet;
          this.runInAngular(() => {
            this.syncSelectionFromCoords(x2, y2, instance);
            if (this.modoFormula && this.fxEditX >= 0) {
              this.insertarReferencia(this.seleccion);
            }
          });
        },
        oneditionstart: (instance: any, td: any, x: any, y: any) => {
          this.spreadsheet = instance ?? this.spreadsheet;
          this.runInAngular(() => {
            this.syncSelectionFromCoords(x, y, instance);
            if (this.formulaBarValor.startsWith('=')) {
              this.modoFormula = true;
              this.fxEditX = x;
              this.fxEditY = y;
              this.setCalcState('editing', 'Editando formula');
              this.actualizarFormulaDecoracion();
            }
          });
          // Esperar a que jspreadsheet cree el editor input dentro del td
          setTimeout(() => {
            const editorEl = (td as HTMLElement)?.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement | null;
            if (editorEl) {
              this.activeCellEditor = editorEl;
              const handler = () => {
                this.runInAngular(() => {
                  const val = editorEl.value || '';
                  this.formulaBarValor = val;
                  if (this.formulaBarInputRef?.nativeElement) {
                    this.formulaBarInputRef.nativeElement.value = val;
                  }
                  if (val.startsWith('=')) {
                    if (!this.modoFormula) {
                      this.modoFormula = true;
                      this.fxEditX = x;
                      this.fxEditY = y;
                      this.setCalcState('editing', 'Editando formula');
                    }
                  } else {
                    this.modoFormula = false;
                    this.fxEditX = -1;
                    this.fxEditY = -1;
                  }
                  this.actualizarFormulaDecoracion();
                });
              };
              editorEl.addEventListener('input', handler);
              this.cellEditorInputHandler = handler;
            }
          }, 0);
        },
        oneditionend: (instance: any, _td: any, _x: any, _y: any, value: any) => {
          this.detachCellEditorListener();
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
            this.actualizarFormulaDecoracion();
            this.setCalcState('ready', 'Edicion finalizada');
          });
        },
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
          secureFormulas: true,
          parseFormulas: true,
          debugFormulas: true,
          autoIncrement: true,
          style: formato?.style
            ? (this.estaModoOscuro() ? this.normalizarEstilosOscuros(formato.style) : formato.style)
            : undefined,
          mergeCells: formato?.mergeCells ?? undefined,
        }]
      });
    } finally {
      try {
        jssAny.calculations?.(true);
      } catch { /* ignore */ }
    }

    this.spreadsheet = Array.isArray(hojas) ? (hojas[0] ?? null) : null;
    this.setCalcState('ready', 'Motor listo');
    this.actualizarFormulaDecoracion();
    this.inicializarBarraFormulaDesdeSeleccion();
    this.attachFormulaModeClickHandler();
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

  private normalizarValorFechaParaCelda(value: any): any {
    const fecha = this.extraerFechaNormalizable(value);
    if (!fecha) {
      return value;
    }
    return this.formatearFechaDdMmYyyy(fecha);
  }

  private extraerFechaNormalizable(value: any): Date | null {
    if (value instanceof Date) {
      return Number.isFinite(value.getTime()) ? value : null;
    }

    if (typeof value !== 'string') {
      return null;
    }

    const txt = value.trim();
    if (!txt) {
      return null;
    }

    const pareceFechaTextoLargo = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s/i.test(txt) && txt.includes('GMT');
    const pareceIso = /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(txt);

    if (!pareceFechaTextoLargo && !pareceIso) {
      return null;
    }

    const parsed = new Date(txt);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }

  private formatearFechaDdMmYyyy(fecha: Date): string {
    const dd = String(fecha.getDate()).padStart(2, '0');
    const mm = String(fecha.getMonth() + 1).padStart(2, '0');
    const yyyy = fecha.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
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
    this.actualizarFormulaDecoracion();
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

  // â”€â”€ Layout de columnas por defecto â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  private columnasPorDefecto(colWidths?: (number | string)[]) {
    const base = [
      { title: 'Codigo',       width: 80,  align: 'center' },
      { title: 'Descripcion',  width: 240 },
      { title: 'Saldo Inicial',width: 130, align: 'right', type: 'numeric', mask: '#.##0,00', decimal: ',' },
      { title: 'Debito',       width: 130, align: 'right', type: 'numeric', mask: '#.##0,00', decimal: ',' },
      { title: 'Credito',      width: 130, align: 'right', type: 'numeric', mask: '#.##0,00', decimal: ',' },
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

  // â”€â”€ Plantilla inicial con ejemplo de Balance Mensual â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  private plantillaVacia(): any[][] {
    const rows: any[][] = [];

    // Fila de tÃ­tulo
    rows.push(['', 'BALANCE MENSUAL', '', '', '', '', '', '', '', '']);
    rows.push(['', '', '', '', '', '', '', '', '', '']);

    // Encabezados
    rows.push(['Codigo', 'Descripcion', 'Saldo Inicial', 'Debito', 'Credito', 'Saldo Final', '', '', '', '']);

    // Filas de cuentas â€” el usuario escribe los cÃ³digos en col A y las fÃ³rmulas en col B-F
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

    // Filas vacÃ­as adicionales
    for (let i = 0; i < 20; i++) {
      rows.push(['', '', '', '', '', '', '', '', '', '']);
    }

    return rows;
  }

  // â”€â”€ CALCULAR: carga contexto y recalcula â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  calcular(): void {
    const errorValidacion = this.validarParametrosActivos();
    if (errorValidacion) {
      this.snackBar.open(errorValidacion, 'OK', { duration: 3000 });
      return;
    }

    // Extraer cuentas individuales y cadenas/rangos del spreadsheet
    const { cuentas, cadenas } = this.extraerCuentasDelSpreadsheet();

    // Si no hay nada detectable, avisar pero continuar con contexto vacío
    if (cuentas.length === 0 && cadenas.length === 0) {
      this.snackBar.open('No se detectaron cuentas. Las formulas OFIMA devolverian 0.', '', { duration: 3000 });
    }

    this.calculando = true;
    this.contextoOk = false;

    const request = this.construirRequestContexto(cuentas, cadenas);

    this.analiticaService.cargarContexto(request).subscribe({
      next: (contexto: ContextoDatos) => {
        OfimaFormulasPlugin.setContexto(contexto);
        this.contextoOk = true;
        this.totalCuentasContexto = Object.keys(contexto.nombresCuentas).length;

        // Forzar recalculo: modificar una celda vacia y restaurar
        this.forzarRecalculo();

        this.calculando = false;
        this.snackBar.open('Contexto cargado: ' + this.totalCuentasContexto + ' cuentas', '', { duration: 2500 });
      },
      error: (err: any) => {
        this.calculando = false;
        console.error('Error cargando contexto:', err);
        this.snackBar.open('Error al cargar los datos del servidor.', 'OK', { duration: 4000 });
      }
    });
  }

  private validarParametrosActivos(): string | null {
    if (this.mostrarCampo('idEmpresa') && !this.params.idEmpresa?.trim()) {
      return 'Ingrese el ID de empresa (GUID) primero.';
    }

    if (this.mostrarCampo('anio1') && !this.esNumeroValido(this.params.anio1)) {
      return 'El valor de Anio 1 no es valido.';
    }

    if (this.mostrarCampo('anio2') && !this.esNumeroValido(this.params.anio2)) {
      return 'El valor de Anio 2 no es valido.';
    }

    if (this.mostrarCampo('mesInicial') && !this.esNumeroValido(this.params.mesInicial)) {
      return 'El valor de Mes Inicial no es valido.';
    }

    if (this.mostrarCampo('mesFinal') && !this.esNumeroValido(this.params.mesFinal)) {
      return 'El valor de Mes Final no es valido.';
    }

    if (this.mostrarCampo('acumulado') && !this.params.acumulado?.trim()) {
      return 'El valor de Acumulado no es valido.';
    }

    if (this.mostrarCampo('nivel') && !this.esNumeroValido(this.params.nivel)) {
      return 'El valor de Nivel de cuentas no es valido.';
    }

    return null;
  }

  private construirRequestContexto(cuentas: string[], cadenas: string[] = []): CargarContextoRequest {
    const request: CargarContextoRequest = { cuentas, cadenas };

    if (this.mostrarCampo('idEmpresa') && this.params.idEmpresa != null) {
      request.idEmpresa = this.params.idEmpresa.trim();
    }
    if (this.mostrarCampo('anio1') && this.params.anio1 != null) {
      request.anio1 = this.params.anio1;
    }
    if (this.mostrarCampo('anio2') && this.params.anio2 != null) {
      request.anio2 = this.params.anio2;
    }
    if (this.mostrarCampo('mesInicial') && this.params.mesInicial != null) {
      request.mesInicial = this.params.mesInicial;
    }
    if (this.mostrarCampo('mesFinal') && this.params.mesFinal != null) {
      request.mesFinal = this.params.mesFinal;
    }
    if (this.mostrarCampo('acumulado') && this.params.acumulado != null) {
      request.acumulado = this.params.acumulado;
    }

    return request;
  }

  private esNumeroValido(valor: number | undefined): boolean {
    return typeof valor === 'number' && Number.isFinite(valor);
  }

  private leerNumero(valor: unknown, fallback: number): number {
    const n = Number(valor);
    return Number.isFinite(n) ? n : fallback;
  }

  private normalizarClaveParam(clave: string): keyof ParametrosSpreadsheet | null {
    const k = clave.trim().toLowerCase();
    switch (k) {
      case 'idempresa':
      case 'empresa':
        return 'idEmpresa';
      case 'anio1':
        return 'anio1';
      case 'anio2':
        return 'anio2';
      case 'mesinicial':
        return 'mesInicial';
      case 'mesfinal':
        return 'mesFinal';
      case 'acumulado':
        return 'acumulado';
      case 'nivel':
        return 'nivel';
      default:
        return null;
    }
  }

  private ordenarCamposActivos(campos: Set<keyof ParametrosSpreadsheet>): Set<keyof ParametrosSpreadsheet> {
    const ordenados: (keyof ParametrosSpreadsheet)[] = [];
    this.allParamKeys.forEach(k => {
      if (campos.has(k)) ordenados.push(k);
    });
    return new Set<keyof ParametrosSpreadsheet>(ordenados);
  }

  private construirParamsDesdeJson(raw: Record<string, unknown>): ParametrosSpreadsheet {
    const next: ParametrosSpreadsheet = {};

    if (this.mostrarCampo('idEmpresa')) {
      const val = raw['idEmpresa'] ?? raw['IdEmpresa'] ?? raw['empresa'] ?? this.defaultParams.idEmpresa;
      next.idEmpresa = String(val ?? '');
    }
    if (this.mostrarCampo('anio1')) {
      next.anio1 = this.leerNumero(raw['anio1'], this.defaultParams.anio1);
    }
    if (this.mostrarCampo('anio2')) {
      next.anio2 = this.leerNumero(raw['anio2'], this.defaultParams.anio2);
    }
    if (this.mostrarCampo('mesInicial')) {
      next.mesInicial = this.leerNumero(raw['mesInicial'], this.defaultParams.mesInicial);
    }
    if (this.mostrarCampo('mesFinal')) {
      next.mesFinal = this.leerNumero(raw['mesFinal'], this.defaultParams.mesFinal);
    }
    if (this.mostrarCampo('acumulado')) {
      next.acumulado = String(raw['acumulado'] ?? this.defaultParams.acumulado);
    }
    if (this.mostrarCampo('nivel')) {
      next.nivel = this.leerNumero(raw['nivel'], this.defaultParams.nivel);
    }

    return next;
  }

  private aplicarParametrosPlantilla(raw: Record<string, unknown>): void {
    const campos = new Set<keyof ParametrosSpreadsheet>();
    Object.keys(raw).forEach(key => {
      const normalizada = this.normalizarClaveParam(key);
      if (normalizada) {
        campos.add(normalizada);
      }
    });

    if (campos.size === 0) {
      this.paramsCampos = new Set<keyof ParametrosSpreadsheet>(this.allParamKeys);
      this.params = { ...this.defaultParams };
      return;
    }

    this.paramsCampos = this.ordenarCamposActivos(campos);
    this.params = this.construirParamsDesdeJson(raw);
  }

  private obtenerParamsActivosParaGuardar(): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    if (this.mostrarCampo('idEmpresa') && this.params.idEmpresa != null) {
      payload['IdEmpresa'] = this.params.idEmpresa.trim();
    }
    if (this.mostrarCampo('anio1') && this.params.anio1 != null) {
      payload['anio1'] = this.params.anio1;
    }
    if (this.mostrarCampo('anio2') && this.params.anio2 != null) {
      payload['anio2'] = this.params.anio2;
    }
    if (this.mostrarCampo('mesInicial') && this.params.mesInicial != null) {
      payload['mesInicial'] = this.params.mesInicial;
    }
    if (this.mostrarCampo('mesFinal') && this.params.mesFinal != null) {
      payload['mesFinal'] = this.params.mesFinal;
    }
    if (this.mostrarCampo('acumulado') && this.params.acumulado != null) {
      payload['acumulado'] = this.params.acumulado;
    }
    if (this.mostrarCampo('nivel') && this.params.nivel != null) {
      payload['nivel'] = this.params.nivel;
    }

    return payload;
  }

  // -- Normaliza estilos de celdas para modo oscuro ---------------------
  private normalizarEstilosOscuros(style: Record<string, string>): Record<string, string> {
    const bgDark = '#07151e';
    const textLight = '#e4eff8';
    const whiteBg = /(background-color|background)\s*:\s*(#(?:fff|ffffff)|white|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))/i;
    const darkText = /color\s*:\s*(#(?:000|000000)|black|rgb\(\s*0\s*,\s*0\s*,\s*0\s*\))/i;
    const result: Record<string, string> = {};

    for (const [cell, cellStyle] of Object.entries(style)) {
      if (!cellStyle) {
        result[cell] = cellStyle;
        continue;
      }

      const adjustedBg = whiteBg.test(cellStyle)
        ? cellStyle.replace(whiteBg, 'background-color: ' + bgDark)
        : cellStyle;

      result[cell] = darkText.test(adjustedBg)
        ? adjustedBg.replace(darkText, 'color: ' + textLight)
        : adjustedBg;
    }

    return result;
  }

  private estaModoOscuro(): boolean {
    return !document.body.classList.contains('light-theme');
  }

  private parsearObjetoJson(valor: unknown): Record<string, unknown> | null {
    if (valor == null) {
      return null;
    }

    if (typeof valor === 'string') {
      const txt = valor.trim();
      if (!txt) {
        return null;
      }
      try {
        const parsed = JSON.parse(txt) as unknown;
        return this.parsearObjetoJson(parsed);
      } catch {
        return null;
      }
    }

    if (typeof valor === 'object' && !Array.isArray(valor)) {
      return valor as Record<string, unknown>;
    }
    return null;
  }

  private extraerCuentasDelSpreadsheet(): { cuentas: string[], cadenas: string[] } {
    const hoja = this.obtenerHojaActiva();
    if (!hoja) return { cuentas: [], cadenas: [] };

    const datos: any[][] = hoja.getData();
    const cuentasSet = new Set<string>();
    const cadenasSet = new Set<string>();

    // SALDOCUENTACONTABLE → siempre va a cadenas (backend lo resuelve con rangos y comas)
    const REGEX_CADENA = /SALDOCUENTACONTABLE\s*\(\s*"([^"]+)"/gi;
    // Resto de funciones OFIMA → extraen códigos individuales
    const REGEX_CUENTA = /(?:SALDOCADENA|SALDOCONTABLECUENTA|NOMBRECTA|SALDOINICIAL|SALDOFINAL|DEBITO|CREDITO|SALDODBCR|SALDOCUENTACONTABLEDBCR)\s*\(\s*"([^"]+)"/gi;

    datos.forEach((fila: any[]) => {
      fila.forEach((celda: any, colIdx: number) => {
        if (!celda || typeof celda !== 'string') return;
        const val = celda.trim();

        // Columna A: código numérico directo (compatibilidad Balance Mensual)
        if (colIdx === 0 && /^\d+$/.test(val)) {
          cuentasSet.add(val);
          return;
        }

        if (!val.startsWith('=')) return;

        // SALDOCUENTACONTABLE → cadenas (soporta rangos con guión)
        REGEX_CADENA.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = REGEX_CADENA.exec(val)) !== null) {
          const arg = m[1].trim();
          if (arg) cadenasSet.add(arg);
        }

        // Otras funciones OFIMA → cuentas individuales
        REGEX_CUENTA.lastIndex = 0;
        while ((m = REGEX_CUENTA.exec(val)) !== null) {
          m[1].split(',').forEach(c => {
            const code = c.trim();
            if (code && /^\d+$/.test(code)) cuentasSet.add(code);
          });
        }
      });
    });

    return { cuentas: Array.from(cuentasSet), cadenas: Array.from(cadenasSet) };
  }

  // â”€â”€ Forzar recÃ¡lculo en jSpreadsheet â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  private forzarRecalculo(): void {
    const hoja = this.obtenerHojaActiva();
    if (!hoja) return;

    const datos: any[][] = hoja.getData();

    // Re-set todas las celdas con fÃ³rmulas para disparar recÃ¡lculo
    datos.forEach((fila: any[], rowIdx: number) => {
      fila.forEach((valor: any, colIdx: number) => {
        if (typeof valor === 'string' && valor.startsWith('=')) {
          hoja.setValueFromCoords(colIdx, rowIdx, valor, true);
        }
      });
    });
  }

  // â”€â”€ Commit desde la barra de fÃ³rmulas (Enter / blur fuera de la hoja) â”€â”€
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
    if (value.startsWith('=')) {
      this.tryExecuteFormulaPreview(value, tx, ty);
    }
    const prev = hoja.getValueFromCoords(tx, ty, true);
    if (String(prev ?? '') !== value) {
      hoja.setValueFromCoords(tx, ty, value, true);
    }
    this.formulaBarValor = value;
    this.formulaActiva   = value.startsWith('=') ? value : '';
    this.modoFormula     = false;
    this.fxEditX         = -1;
    this.fxEditY         = -1;
    this.actualizarFormulaDecoracion();
    this.setCalcState('ready', 'Formula aplicada');
  }

  private tryExecuteFormulaPreview(expression: string, x: number, y: number): void {
    try {
      const hoja = this.obtenerHojaActiva();
      const fn = hoja?.executeFormula;
      if (typeof fn !== 'function') {
        return;
      }
      this.setCalcState('calculating', expression);
      fn.call(hoja, expression, x, y, false, true);
      this.setCalcState('ready', 'Formula validada');
    } catch {
      this.setCalcState('error', 'Formula invalida');
    }
  }

  // â”€â”€ Handlers del <input> de la barra de fÃ³rmulas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  onFxFocus(): void {
    this.fxFocused = true;
    // Si el valor ya empieza con = al recibir foco, activar modo fÃ³rmula
    if (this.formulaBarValor.startsWith('=') && this.fxEditX < 0) {
      this.modoFormula = true;
      this.fxEditX     = this.selX;
      this.fxEditY     = this.selY;
    }
    this.setCalcState('editing', 'Editando formula');
    this.actualizarFormulaDecoracion();
  }

  onFxInput(value: string): void {
    this.formulaBarValor = value;
    if (value.startsWith('=')) {
      this.modoFormula = true;
      if (this.fxEditX < 0) { this.fxEditX = this.selX; this.fxEditY = this.selY; }
      this.setCalcState('editing', 'Editando formula');
    } else {
      this.modoFormula = false;
      this.fxEditX = -1;
      this.fxEditY = -1;
      this.setCalcState('ready', 'Valor en edicion');
    }
    this.actualizarFormulaDecoracion();
  }

  onFxBlur(value: string): void {
    this.fxFocused = false;
    this.formulaBarValor = value;
    // Esperar a que onselection se procese antes de decidir si hay que commitear
    setTimeout(() => {
      if (!this.fxFocused) {
        // El foco no volvio a la barra (el usuario no hizo clic en una celda para
        // insertar referencia) â†’ commitear y salir del modo fÃ³rmula
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
      this.actualizarFormulaDecoracion();
      this.setCalcState('ready', 'Edicion cancelada');
    }
  }

  // â”€â”€ Insertar referencia de celda en la posiciÃ³n del cursor del input â”€â”€
  private insertarReferencia(ref: string): void {
    // Determinar fuente de posicion: editor de celda activo o barra de formulas
    const cellEd = this.activeCellEditor;
    const fxInput = this.formulaBarInputRef?.nativeElement;
    const source = cellEd || fxInput;
    const start = source?.selectionStart ?? this.formulaBarValor.length;
    const end   = source?.selectionEnd   ?? this.formulaBarValor.length;

    this.formulaBarValor =
      this.formulaBarValor.substring(0, start) +
      ref +
      this.formulaBarValor.substring(end);

    // Sincronizar barra de formulas
    if (fxInput) {
      fxInput.value = this.formulaBarValor;
    }
    // Sincronizar editor in-cell
    if (cellEd) {
      cellEd.value = this.formulaBarValor;
    }

    this.actualizarFormulaDecoracion();

    // Re-enfocar el editor de celda y posicionar cursor
    setTimeout(() => {
      const pos = start + ref.length;
      if (cellEd) {
        cellEd.focus();
        cellEd.setSelectionRange(pos, pos);
      } else if (fxInput) {
        fxInput.focus();
        fxInput.setSelectionRange(pos, pos);
      }
    }, 10);
  }

  private detachCellEditorListener(): void {
    if (this.activeCellEditor && this.cellEditorInputHandler) {
      this.activeCellEditor.removeEventListener('input', this.cellEditorInputHandler);
    }
    this.activeCellEditor = null;
    this.cellEditorInputHandler = null;
  }

  // -- Interceptor de clics en modo formula (captura antes que jspreadsheet) --
  private attachFormulaModeClickHandler(): void {
    if (this.formulaModeClickHandler) return;
    const container = this.containerRef?.nativeElement;
    if (!container) return;

    this.formulaModeClickHandler = (e: MouseEvent) => {
      if (!this.modoFormula || this.fxEditX < 0) return;

      const target = e.target as HTMLElement;
      // Solo interceptar clics en celdas de datos (td con data-x y data-y)
      const td = target.closest('td[data-x][data-y]') as HTMLElement;
      if (!td) return;

      const x = parseInt(td.getAttribute('data-x') || '-1', 10);
      const y = parseInt(td.getAttribute('data-y') || '-1', 10);
      if (x < 0 || y < 0) return;

      // No insertar referencia a la propia celda en edicion
      if (x === this.fxEditX && y === this.fxEditY) return;

      // Prevenir que jspreadsheet cierre el editor y maneje la seleccion
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const ref = `${this.colIndexToLetter(x + 1)}${y + 1}`;
      this.runInAngular(() => this.insertarReferencia(ref));
    };

    // Fase de captura para interceptar antes que jspreadsheet
    container.addEventListener('mousedown', this.formulaModeClickHandler, true);
  }

  private detachFormulaModeClickHandler(): void {
    if (this.formulaModeClickHandler && this.containerRef?.nativeElement) {
      this.containerRef.nativeElement.removeEventListener('mousedown', this.formulaModeClickHandler, true);
    }
    this.formulaModeClickHandler = null;
  }

  private setCalcState(state: FormulaCalcState, detalle: string): void {
    this.calcState = state;
    this.calcStateDetalle = detalle;
  }

  private actualizarFormulaDecoracion(): void {
    const formula = this.formulaBarValor || '';
    if (!this.modoFormula || !formula.startsWith('=')) {
      this.formulaBarTokens = [{ text: formula }];
      this.formulaRefs = [];
      this.clearFormulaHighlights();
      return;
    }

    const parsed = this.parseFormulaReferences(formula);
    this.formulaBarTokens = parsed.tokens;
    this.formulaRefs = parsed.refs;
    this.paintFormulaHighlights(parsed.refs);
  }

  private parseFormulaReferences(formula: string): { tokens: FormulaBarToken[]; refs: FormulaReference[] } {
    const tokens: FormulaBarToken[] = [];
    const refs: FormulaReference[] = [];
    const colorByKey = new Map<string, string>();
    const refRegex = /(\$?[A-Z]{1,3}\$?\d+)(:\$?[A-Z]{1,3}\$?\d+)?/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let colorIndex = 0;

    while ((match = refRegex.exec(formula)) !== null) {
      const whole = match[0];
      const startRef = match[1];
      const endRef = match[2] ? match[2].slice(1) : '';
      const start = match.index;
      const end = start + whole.length;
      const prev = start > 0 ? formula[start - 1] : '';
      const next = end < formula.length ? formula[end] : '';

      if ((prev && /[A-Z0-9_]/i.test(prev)) || (next && /[A-Z0-9_]/i.test(next)) || next === '(') {
        continue;
      }

      if (start > lastIndex) {
        tokens.push({ text: formula.slice(lastIndex, start) });
      }

      const key = `${startRef}:${endRef || startRef}`;
      if (!colorByKey.has(key)) {
        colorByKey.set(key, this.formulaRefPalette[colorIndex % this.formulaRefPalette.length]);
        colorIndex++;
      }
      const color = colorByKey.get(key) as string;

      tokens.push({ text: whole, color });
      lastIndex = end;

      const parsedStart = this.parseRefToCoords(startRef);
      const parsedEnd = this.parseRefToCoords(endRef || startRef);
      if (parsedStart && parsedEnd) {
        refs.push({
          key,
          startX: Math.min(parsedStart.x, parsedEnd.x),
          startY: Math.min(parsedStart.y, parsedEnd.y),
          endX: Math.max(parsedStart.x, parsedEnd.x),
          endY: Math.max(parsedStart.y, parsedEnd.y),
          color
        });
      }
    }

    if (lastIndex < formula.length) {
      tokens.push({ text: formula.slice(lastIndex) });
    }

    return { tokens: tokens.length ? tokens : [{ text: formula }], refs };
  }

  private parseRefToCoords(ref: string): { x: number; y: number } | null {
    const cleaned = (ref || '').replace(/\$/g, '').toUpperCase();
    const m = cleaned.match(/^([A-Z]{1,3})(\d+)$/);
    if (!m) {
      return null;
    }
    const col = m[1];
    const row = Number(m[2]);
    if (!Number.isFinite(row) || row <= 0) {
      return null;
    }
    return { x: this.colLetterToIndex(col) - 1, y: row - 1 };
  }

  private paintFormulaHighlights(refs: FormulaReference[]): void {
    this.clearFormulaHighlights();
    const hoja = this.obtenerHojaActiva();
    if (!hoja || refs.length === 0) {
      return;
    }

    const maxCellsToPaint = 600;
    let painted = 0;

    refs.forEach((ref, refIdx) => {
      for (let y = ref.startY; y <= ref.endY; y++) {
        for (let x = ref.startX; x <= ref.endX; x++) {
          if (painted >= maxCellsToPaint) {
            return;
          }
          const cell = typeof hoja.getCellFromCoords === 'function'
            ? (hoja.getCellFromCoords(x, y) as HTMLElement | undefined)
            : undefined;
          if (!cell) {
            continue;
          }
          cell.classList.add('formula-ref-highlight', `formula-ref-highlight--${refIdx % this.formulaRefPalette.length}`);
          cell.style.setProperty('--formula-ref-color', ref.color);
          this.highlightedFormulaCells.push(cell);
          painted++;
        }
      }
    });
  }

  private clearFormulaHighlights(): void {
    this.highlightedFormulaCells.forEach(cell => {
      this.formulaRefPalette.forEach((_, idx) => cell.classList.remove(`formula-ref-highlight--${idx}`));
      cell.classList.remove('formula-ref-highlight');
      cell.style.removeProperty('--formula-ref-color');
    });
    this.highlightedFormulaCells = [];
  }

  // â”€â”€ Copiar fÃ³rmula al portapapeles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  copiarFormula(formula: string): void {
    navigator.clipboard.writeText(formula).then(() => {
      this.snackBar.open(`Copiado: ${formula}`, '', { duration: 1500 });
    });
  }

  // â”€â”€ Exportar a Excel (.xlsx con estilos, merges y anchos) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Ãndice base 1 â†’ letra(s) de columna (1â†’"A", 27â†’"AA") â”€â”€â”€â”€â”€â”€â”€â”€â”€
  private colIndexToLetter(index: number): string {
    let result = '';
    while (index > 0) {
      result = String.fromCharCode(64 + ((index - 1) % 26 + 1)) + result;
      index  = Math.floor((index - 1) / 26);
    }
    return result;
  }


  // -- Nueva plantilla -------------------------------------------------
  nuevaPlantilla(): void {
    this.plantillaIdActual       = undefined;
    this.plantillaNombre         = '';
    this.plantillaDescripcion    = '';
    this.plantillaSeleccionadaNombre = '';
    this.paramsCampos = new Set<keyof ParametrosSpreadsheet>(this.allParamKeys);
    this.params       = { ...this.defaultParams };
    this.contextoOk   = false;
    this.totalCuentasContexto = 0;
    OfimaFormulasPlugin.clearContexto();
    this.inicializarSpreadsheet();
  }

  // -- Guardar plantilla ------------------------------------------------
  guardarPlantilla(): void {
    if (this.plantillaIdActual && this.plantillaNombre) {
      this.ejecutarGuardado();
    } else {
      this.dialogRef = this.dialog.open(this.dialogoGuardarTpl, { width: '420px' });
      this.dialogRef.afterClosed().subscribe((confirmar: boolean) => {
        if (!confirmar || !this.plantillaNombre) return;
        this.ejecutarGuardado();
      });
    }
  }

  private ejecutarGuardado(): void {
    const hoja = this.obtenerHojaActiva();
    const datos    = hoja?.getData()   ?? [];
    const estilos  = hoja?.getStyle()  ?? {};
    const merges   = hoja?.getMerge()  ?? {};
    const anchos   = hoja?.getWidth()  ?? [];
    const altos    = hoja?.getHeight() ?? [];

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
      params: this.obtenerParamsActivosParaGuardar(),
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
        this.plantillaNombre = p.nombre;
        this.plantillaDescripcion = p.descripcion;
        this.plantillaSeleccionadaNombre = p.nombre;
        this.snackBar.open(`\u2713 Plantilla "${p.nombre}" guardada`, '', { duration: 3000 });
      },
      error: () => this.snackBar.open('Error al guardar la plantilla', 'OK', { duration: 3000 })
    });
  }


  // â”€â”€ Abrir diÃ¡logo de plantillas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  abrirDialogoPlantillas(): void {
    this.analiticaService.getPlantillas().subscribe((lista: PlantillaAnalitica[]) => {
      this.plantillas = lista;
      this.dialogRef = this.dialog.open(this.dialogoPlantillasTpl, { width: '520px', maxHeight: '70vh' });
    });
  }

  // â”€â”€ Cargar plantilla â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  cargarPlantilla(plantilla: PlantillaAnalitica): void {
    this.dialogRef?.close();
    this.aplicarContenidoPlantilla(plantilla);
  }

  private aplicarContenidoPlantilla(plantilla: PlantillaAnalitica): void {
    try {
      const parsed = this.parsearObjetoJson(plantilla.contenido);
      if (!parsed) {
        throw new Error('Contenido de plantilla invalido.');
      }

      this.plantillaIdActual = plantilla.id;
      this.plantillaNombre = plantilla.nombre;
      this.plantillaDescripcion = plantilla.descripcion;
      this.plantillaSeleccionadaNombre = plantilla.nombre;

      const paramsTemplate = this.parsearObjetoJson(parsed['params']);
      if (paramsTemplate) {
        this.aplicarParametrosPlantilla(paramsTemplate);
      } else {
        this.paramsCampos = new Set<keyof ParametrosSpreadsheet>(this.allParamKeys);
        this.params = { ...this.defaultParams };
      }

      const data = parsed['data'];
      if (Array.isArray(data)) {
        this.inicializarSpreadsheet(data, {
          style:      parsed['style']      as Record<string, string> | undefined,
          mergeCells: parsed['mergeCells'] as Record<string, [number, number]> | undefined,
          colWidths:  parsed['colWidths']  as (number | string)[] | undefined,
          rowHeights: parsed['rowHeights'] as string[] | undefined,
        });
      }

      this.snackBar.open(`âœ“ Plantilla "${plantilla.nombre}" cargada`, '', { duration: 2500 });
    } catch {
      this.snackBar.open('Error al cargar la plantilla', 'OK', { duration: 3000 });
    }
  }

  // â”€â”€ Eliminar plantilla â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
