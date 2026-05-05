// ─────────────────────────────────────────────────────────────────────────────
// _parse_isr.js  — Parsea "Analitica DETERMINACION IMPUESTO ISR - PERSONAS FISICAS.xlsx"
//                  y genera JSON plantilla + SQL INSERT para Catalogo.PlantillaAnalitica
// ─────────────────────────────────────────────────────────────────────────────
const ExcelJS = require('exceljs');
const fs      = require('fs');
const path    = require('path');

const EXCEL_FILE  = path.join(__dirname, 'Analitica DETERMINACION IMPUESTO ISR - PERSONAS FISICAS.xlsx');
const OUTPUT_JSON = path.join(__dirname, '_isr_output.json');
const OUTPUT_SQL  = path.join(__dirname, '_isr_insert.sql');

// ── Filas del bloque de parámetros en el Excel (1-indexed) ──
const PARAM_ROWS_START = 1;
const PARAM_ROWS_END   = 12;   // hasta "FIN-PARAMETROS"
const ROW_OFFSET       = PARAM_ROWS_END;
// Fila 11 en Excel → fila 0 del grid (0-indexed)

// ── Helpers ──────────────────────────────────────────────────────────────────
function colLetter(colIdx) {  // 0-based → "A","B",...
  let s = '';
  let n = colIdx;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function argbToHex(argb) {
  if (!argb || argb.length < 8) return null;
  const hex = argb.slice(2);       // drop alpha channel (FF)
  return '#' + hex.toLowerCase();
}

function extractCellStyles(cell) {
  const styles = [];
  try {
    const f = cell.font || {};
    const a = cell.alignment || {};
    const fill = cell.fill || {};

    if (f.bold) styles.push('font-weight: bold');
    if (f.italic) styles.push('font-style: italic');

    const fontSize = f.size || 10;
    styles.push(`font-size: ${fontSize}pt`);

    if (f.color?.argb) {
      const c = argbToHex(f.color.argb);
      if (c && c !== '#000000' && c !== '#000') styles.push(`color: ${c}`);
    }

    if (fill.type === 'pattern' && fill.pattern !== 'none' && fill.fgColor?.argb) {
      const bg = argbToHex(fill.fgColor.argb);
      if (bg && bg !== '#ffffff') styles.push(`background-color: ${bg}`);
    }

    const hMap = { left: 'left', center: 'center', right: 'right', distributed: 'center' };
    if (a.horizontal && hMap[a.horizontal]) styles.push(`text-align: ${hMap[a.horizontal]}`);

  } catch (e) { /* ignore */ }
  return styles;
}

// ── Transformar fórmulas Excel/VBS → OFIMA plugin ────────────────────────────
function transformFormula(formula, rowOffset) {
  if (!formula) return '';
  let f = '=' + formula;

  // [1]!SaldoContableCuentaCadena("cuentas",...) → SALDOCUENTACONTABLE("cuentas")  [arg literal]
  f = f.replace(
    /\[1\]!SaldoContableCuentaCadena\s*\(\s*("[^"]*")(?:,[^)]+)?\)/gi,
    'SALDOCUENTACONTABLE($1)'
  );

  // [1]!SaldoContableCuentaCadena($BXX, D$17,...) → SALDOCUENTACONTABLE($BXX,D$17)  [arg celda]
  f = f.replace(
    /\[1\]!SaldoContableCuentaCadena\s*\(\s*(\$?[A-Z]{1,3}\$?\d+)\s*,\s*(\$?[A-Z]{1,3}\$?\d+)(?:,[^)]+)?\)/gi,
    'SALDOCUENTACONTABLE($1,$2)'
  );

  // [1]!SaldoCuentaCadena("cuentas",...) → SALDOCUENTACONTABLE("cuentas")
  f = f.replace(
    /\[1\]!SaldoCuentaCadena\s*\(\s*("[^"]*")(?:,[^)]+)?\)/gi,
    'SALDOCUENTACONTABLE($1)'
  );

  // [1]!SaldoContableCuenta(cuenta,...) → SALDOCONTABLECUENTA(cuenta)
  f = f.replace(
    /\[1\]!SaldoContableCuenta\s*\(([^,]+)(?:,[^)]+)?\)/gi,
    'SALDOCONTABLECUENTA($1)'
  );

  // [1]!SaldoContableCtaDBCR(cuenta, periodo, tipo,...) → SALDODBCR(cuenta,periodo,tipo)
  f = f.replace(
    /\[1\]!SaldoContableCtaDBCR\s*\(([^,]+),([^,]+),([^,]+)(?:,[^)]+)?\)/gi,
    'SALDODBCR($1,$2,$3)'
  );

  // [1]!NombreCta(cuenta,...) → NOMBRECTA(cuenta)
  f = f.replace(
    /\[1\]!NombreCta\s*\(([^,)]+)(?:,[^)]+)?\)/gi,
    'NOMBRECTA($1)'
  );

  // [1]!nomcia() → vacío (no soportado en plugin)
  if (/\[1\]!nomcia\(\)/i.test(f)) return '';

  // CONCATENATE con referencia al bloque de params → simplificar
  f = f.replace(/=CONCATENATE\s*\("([^"]*)",\s*\$?D\$?8\)/gi, '="$1"');

  // Ajustar referencias de celda por el row offset
  f = adjustCellRefs(f, rowOffset);

  return f;
}

function adjustCellRefs(formula, rowOffset) {
  if (rowOffset === 0) return formula;
  const parts = formula.split(/(\"[^\"]*\")/g);
  return parts.map((part, idx) => {
    if (idx % 2 === 1) return part;
    return part.replace(/(\$?[A-Z]{1,3})(\$?)(\d+)/g, (_m, col, dollar, rowStr) => {
      const oldRow = parseInt(rowStr, 10);
      const newRow = oldRow - rowOffset;
      if (newRow < 1) return '0';
      return `${col}${dollar}${newRow}`;
    });
  }).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL_FILE);

  const ws = wb.worksheets[0];
  const totalRows = ws.rowCount;
  const totalCols = ws.columnCount;

  console.log(`Hoja: "${ws.name}" — ${totalRows} filas, ${totalCols} cols`);

  // ── 1. Extraer parámetros (filas 1–12): clave en col C (idx 3), valor en col D (idx 4) ──
  const params = {};
  for (let r = PARAM_ROWS_START; r <= PARAM_ROWS_END; r++) {
    const row = ws.getRow(r);
    const cellC = row.getCell(3); // columna C
    const cellD = row.getCell(4); // columna D
    const keyRaw = cellC.value;
    const valRaw = cellD.value;
    if (!keyRaw) continue;
    const keyStr = (typeof keyRaw === 'object' && keyRaw?.richText)
      ? keyRaw.richText.map(x => x.text).join('')
      : String(keyRaw);
    const valStr = valRaw !== null && valRaw !== undefined
      ? (typeof valRaw === 'object' && valRaw?.richText ? valRaw.richText.map(x=>x.text).join('') : String(valRaw))
      : '';
    const key = keyStr.trim().toLowerCase()
      .replace(/[áàä]/g,'a').replace(/[éèë]/g,'e')
      .replace(/[íìï]/g,'i').replace(/[óòö]/g,'o')
      .replace(/[úùü]/g,'u').replace(/\s+/g,'');
    if (key && !['inicio-parametros','fin-parametros','depurar'].includes(key)) {
      params[key] = valStr.trim();
    }
  }
  console.log('Params extraídos:', params);

  // Normalizar params al formato del frontend
  const paramsJson = {
    nivel:      parseInt(params['nivel'] || params['niveldecuentas'] || '3', 10),
    mesInicial: parseInt(params['mesinicial'] || params['mesinicio'] || params['periodo'] || '1', 10),
    mesFinal:   parseInt(params['mesfinal'] || params['mes'] || params['periodo'] || '12', 10),
    acumulado:  (params['acumulado'] || 'M').toUpperCase(),
    idEmpresa:  params['empresa'] || params['idempresa'] || '',
    anio1:      parseInt(params['ano'] || params['año'] || params['anio'] || params['anio1'] || new Date().getFullYear(), 10),
    anio2:      parseInt(params['ano2'] || params['año2'] || params['anio2'] || new Date().getFullYear(), 10),
  };
  console.log('Params normalizados:', paramsJson);

  // ── 2. Columnas: anchos ───────────────────────────────────────────────────
  const DATA_START_ROW = PARAM_ROWS_END + 1;
  let maxCol = 0;

  // Detectar # de columnas reales
  for (let r = DATA_START_ROW; r <= totalRows; r++) {
    const row = ws.getRow(r);
    if (row.actualCellCount > maxCol) maxCol = row.actualCellCount;
  }
  maxCol = Math.max(maxCol, totalCols, 15); // ISR tiene al menos 15 cols (Cuenta+Desc+12 meses+Total)
  console.log(`Max columnas: ${maxCol}`);

  const colWidths = [];
  for (let c = 1; c <= maxCol; c++) {
    const col = ws.getColumn(c);
    colWidths.push(col.width ? Math.round(col.width * 7) : 80);
  }

  // ── 3. Alturas de filas (ajustadas) ──────────────────────────────────────
  const rowHeights = {};
  for (let r = DATA_START_ROW; r <= totalRows; r++) {
    const row = ws.getRow(r);
    if (row.height && row.height !== 15) {
      rowHeights[r - DATA_START_ROW] = Math.round(row.height * 1.33);
    }
  }

  // ── 4. Merge cells ────────────────────────────────────────────────────────
  const mergeCells = {};
  const mergedNonOrigin = new Set();

  if (ws._merges) {
    for (const [, merge] of Object.entries(ws._merges)) {
      const m = merge.model || merge;
      if (m.top < DATA_START_ROW) continue;
      const adjRow  = m.top  - DATA_START_ROW;
      const adjCol  = m.left - 1;
      const colspan = m.right - m.left + 1;
      const rowspan = m.bottom - m.top + 1;
      if (colspan > 1 || rowspan > 1) {
        const ref = `${colLetter(adjCol)}${adjRow}`;
        mergeCells[ref] = [colspan, rowspan];
        for (let mr = 0; mr < rowspan; mr++) {
          for (let mc = 0; mc < colspan; mc++) {
            if (mr === 0 && mc === 0) continue;
            mergedNonOrigin.add(`${adjCol + mc},${adjRow + mr}`);
          }
        }
      }
    }
  }
  console.log(`Merge cells: ${Object.keys(mergeCells).length}`);

  // ── 5. Datos y estilos ────────────────────────────────────────────────────
  const data  = [];
  const style = {};
  let formulasTransformed = 0;

  for (let r = DATA_START_ROW; r <= totalRows; r++) {
    const row    = ws.getRow(r);
    const adjRow = r - DATA_START_ROW;
    const rowData = [];

    for (let c = 1; c <= maxCol; c++) {
      const adjCol  = c - 1;
      const cell    = row.getCell(c);

      // Celdas no-origen de merge → vacías
      if (mergedNonOrigin.has(`${adjCol},${adjRow}`)) {
        rowData.push('');
        const cStyles = extractCellStyles(cell);
        if (cStyles.length > 0) style[`${colLetter(adjCol)}${adjRow}`] = cStyles.join('; ');
        continue;
      }

      const v = cell.value;
      let cellVal = '';

      if (v === null || v === undefined) {
        cellVal = '';
      } else if (typeof v === 'object' && v.formula) {
        const transformed = transformFormula(v.formula, ROW_OFFSET);
        // Nota: transformed puede ser '' (e.g. nomcia()) — no usar || que trata '' como falsy
        const original = '=' + v.formula;
        if (transformed !== original) formulasTransformed++;
        cellVal = transformed;  // '' es intencional (nomcia, etc.)
        if (transformed !== original && transformed) {
          console.log(`  [${r},${c}] ${v.formula.substring(0, 60)} → ${transformed.substring(0, 60)}`);
        }
      } else if (typeof v === 'object' && v.richText) {
        cellVal = v.richText.map(x => x.text).join('');
      } else if (typeof v === 'object' && v instanceof Date) {
        cellVal = v.toISOString().slice(0, 10);
      } else if (typeof v === 'object' && v.sharedFormula) {
        const transformed = transformFormula(v.sharedFormula, ROW_OFFSET);
        cellVal = transformed;  // puede ser '' intencionalmente
      } else {
        cellVal = String(v);
      }

      rowData.push(cellVal);

      // Estilos
      const cStyles = extractCellStyles(cell);
      if (cStyles.length > 0) {
        style[`${colLetter(adjCol)}${adjRow}`] = cStyles.join('; ');
      }
    }

    data.push(rowData);
  }

  console.log(`\nFilas de datos: ${data.length}`);
  console.log(`Fórmulas transformadas: ${formulasTransformed}`);
  console.log(`Estilos capturados: ${Object.keys(style).length}`);

  // ── 6. Construir JSON plantilla ───────────────────────────────────────────
  const plantilla = {
    params:     JSON.stringify(paramsJson),
    data,
    style,
    mergeCells,
    colWidths,
    rowHeights,
  };

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(plantilla, null, 2), 'utf8');
  console.log(`\n✓ JSON generado: ${OUTPUT_JSON}`);

  // ── 7. Generar SQL INSERT ─────────────────────────────────────────────────
  const contenidoJson = JSON.stringify(plantilla).replace(/'/g, "''");

  const sql = `
-- Insertar plantilla: Determinacion Impuesto ISR - Personas Fisicas
-- Generado automaticamente desde: Analitica DETERMINACION IMPUESTO ISR - PERSONAS FISICAS.xlsx
INSERT INTO Catalogo.PlantillaAnalitica
  (IdPlantilla, Nombre, Descripcion, Contenido, Activo, FechaRegistro, FechaActualizacion)
VALUES
  ('ISR-PF-001', 'Determinacion Impuesto ISR - Personas Fisicas', 'Determinacion del Impuesto ISR para Personas Fisicas. Plantilla migrada desde Excel OFIMA.',
   '${contenidoJson}',
   1, GETUTCDATE(), GETUTCDATE());
`;

  fs.writeFileSync(OUTPUT_SQL, sql, 'utf8');
  console.log(`✓ SQL generado: ${OUTPUT_SQL}`);
  console.log('\nListo.');
}

main().catch(e => { console.error('ERROR:', e); process.exit(1); });
