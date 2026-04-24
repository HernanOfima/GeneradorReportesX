export interface CargarContextoRequest {
  empresa: string;
  anio1: number;
  anio2: number;
  mesInicial: number;
  mesFinal: number;
  acumulado: string;
  cuentas: string[];
}

export interface ContextoDatos {
  nombresCuentas: { [cuenta: string]: string };
  saldosIniciales: { [cuenta: string]: number };
  saldosFinales: { [cuenta: string]: number };
  debitos: { [cuenta: string]: number };
  creditos: { [cuenta: string]: number };
  saldosCadenaInicial: { [key: string]: number };
  saldosCadenaFinal: { [key: string]: number };
}

export interface PlantillaAnalitica {
  id: string;
  nombre: string;
  descripcion: string;
  contenido: string;
  fechaActualizacion: Date;
}

export interface GuardarPlantillaRequest {
  id?: string;
  nombre: string;
  descripcion: string;
  contenido: string;
}

export interface ParametrosSpreadsheet {
  empresa: string;
  anio1: number;
  anio2: number;
  mesInicial: number;
  mesFinal: number;
  acumulado: string;
  nivel: number;
}

export const MESES = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
];
