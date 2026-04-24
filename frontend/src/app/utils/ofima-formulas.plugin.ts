import formulaEngine from '@jspreadsheet/formula';
import { ContextoDatos } from '../models/analitica.models';

export class OfimaFormulasPlugin {
  private static contexto: ContextoDatos | null = null;
  private static registrado = false;

  static registrar(): void {
    if (OfimaFormulasPlugin.registrado) {
      return;
    }

    formulaEngine.setFormula({
      NOMBRECTA: (cuenta: unknown) => OfimaFormulasPlugin.nombreCuenta(cuenta),
      SALDOINICIAL: (cuenta: unknown) => OfimaFormulasPlugin.saldoInicial(cuenta),
      SALDOFINAL: (cuenta: unknown) => OfimaFormulasPlugin.saldoFinal(cuenta),
      DEBITO: (cuenta: unknown) => OfimaFormulasPlugin.debito(cuenta),
      CREDITO: (cuenta: unknown) => OfimaFormulasPlugin.credito(cuenta),
      SALDOCADENA: (cuentas: unknown) => OfimaFormulasPlugin.saldoCadena(cuentas),
      SALDOCONTABLECUENTA: (cuenta: unknown) => OfimaFormulasPlugin.saldoFinal(cuenta),
      SALDODBCR: (cuenta: unknown, _periodo: unknown, naturaleza: unknown) =>
        OfimaFormulasPlugin.saldoDbCr(cuenta, naturaleza)
    });

    OfimaFormulasPlugin.registrado = true;
  }

  static setContexto(ctx: ContextoDatos): void {
    OfimaFormulasPlugin.contexto = ctx;
  }

  static clearContexto(): void {
    OfimaFormulasPlugin.contexto = null;
  }

  private static nombreCuenta(cuenta: unknown): string {
    const codigo = OfimaFormulasPlugin.normalizarCuenta(cuenta);
    const ctx = OfimaFormulasPlugin.contexto;

    if (!ctx) {
      return '#SIN-CONTEXTO';
    }

    return ctx.nombresCuentas[codigo] ?? `Cuenta ${codigo}`;
  }

  private static saldoInicial(cuenta: unknown): number {
    const codigo = OfimaFormulasPlugin.normalizarCuenta(cuenta);
    return OfimaFormulasPlugin.contexto?.saldosIniciales[codigo] ?? 0;
  }

  private static saldoFinal(cuenta: unknown): number {
    const codigo = OfimaFormulasPlugin.normalizarCuenta(cuenta);
    return OfimaFormulasPlugin.contexto?.saldosFinales[codigo] ?? 0;
  }

  private static debito(cuenta: unknown): number {
    const codigo = OfimaFormulasPlugin.normalizarCuenta(cuenta);
    return OfimaFormulasPlugin.contexto?.debitos[codigo] ?? 0;
  }

  private static credito(cuenta: unknown): number {
    const codigo = OfimaFormulasPlugin.normalizarCuenta(cuenta);
    return OfimaFormulasPlugin.contexto?.creditos[codigo] ?? 0;
  }

  private static saldoDbCr(cuenta: unknown, naturaleza: unknown): number {
    const codigo = OfimaFormulasPlugin.normalizarCuenta(cuenta);
    const tipo = String(naturaleza ?? '').trim().toUpperCase();

    if (tipo === 'CR') {
      return OfimaFormulasPlugin.contexto?.creditos[codigo] ?? 0;
    }

    return OfimaFormulasPlugin.contexto?.debitos[codigo] ?? 0;
  }

  private static saldoCadena(cuentas: unknown): number {
    const lista = String(cuentas ?? '')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    if (lista.length === 0) {
      return 0;
    }

    const ctx = OfimaFormulasPlugin.contexto;
    if (!ctx) {
      return 0;
    }

    return lista.reduce((total, cuenta) => total + (ctx.saldosFinales[cuenta] ?? 0), 0);
  }

  private static normalizarCuenta(cuenta: unknown): string {
    return String(cuenta ?? '').trim();
  }
}
