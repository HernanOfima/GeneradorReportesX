export interface Module {
  idModulo: string; // Guid from backend as string
  nombre: string;
  administrador: boolean;
  fechaRegistro: Date;
  fechaActualizacion: Date;
  usuario: string;
  programa: string;
  activo: boolean;
  reportes: Report[];
}

export interface Report {
  idReporte: string; // Guid from backend as string
  nombre: string;
  titulo: string;
  idModulo: string; // Guid from backend as string
  sentenciaSQL: string;
  tipoReporte: number; // 1 = Query/Vista/Función, 2 = Stored Procedure
  moduloNombre: string;
}

export interface ReportParameter {
  name: string;
  displayName: string;
  dataType: string;
  isRequired: boolean;
  defaultValue?: any;
}

export interface ReportResult {
  data: { [key: string]: any }[];
  columns: string[];
  parameters: ReportParameter[];
  totalRecords: number;
}

export interface ExecuteReportRequest {
  reportId: string;
  parameters: { [key: string]: any };
}

export interface ExportRequest {
  reportId: string;
  parameters: { [key: string]: any };
}
