/**
 * Utility functions for Spanish number formatting
 */
export class NumberFormatUtil {
  
  /**
   * Format number with Spanish locale (thousands separator as dots, no decimals)
   * Example: 10000.50 -> "10.000"
   */
  static formatSpanishNumber(value: any, decimals: number = 0): string {
    if (value === null || value === undefined || value === '' || isNaN(Number(value))) {
      return '';
    }

    const numValue = Number(value);
    
    // Format with Spanish locale - round to integer and use thousands separators
    return new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: true
    }).format(Math.round(numValue));
  }

  /**
   * Detect if a column name represents a numeric/monetary value
   */
  static isNumericColumn(columnName: string): boolean {
    const numericPatterns = [
      /subtotal/i,
      /descuento/i,
      /valor.*iva/i,
      /retencion.*iva/i,
      /total.*documento/i,
      /precio/i,
      /importe/i,
      /monto/i,
      /cantidad/i,
      /^valor$/i,
      /^total$/i,
      /^neto$/i,
      /^bruto$/i,
      /base.*gravable/i,
      /impuesto/i,
      /^iva$/i,
      /^ice$/i,
      /^irbpnr$/i
    ];

    return numericPatterns.some(pattern => pattern.test(columnName));
  }

  /**
   * Detect if a value appears to be numeric
   */
  static isNumericValue(value: any): boolean {
    if (value === null || value === undefined || value === '') {
      return false;
    }
    
    const numValue = Number(value);
    return !isNaN(numValue) && isFinite(numValue);
  }

  /**
   * Auto-detect if a column should be formatted as numeric based on column name and sample values
   */
  static shouldFormatAsNumeric(columnName: string, sampleValues: any[] = []): boolean {
    // First check by column name
    if (this.isNumericColumn(columnName)) {
      return true;
    }

    // Then check sample values if column name doesn't match patterns
    if (sampleValues.length > 0) {
      const numericValues = sampleValues.filter(v => this.isNumericValue(v));
      // If most values are numeric, consider it a numeric column
      return numericValues.length / sampleValues.length > 0.7;
    }

    return false;
  }
}
