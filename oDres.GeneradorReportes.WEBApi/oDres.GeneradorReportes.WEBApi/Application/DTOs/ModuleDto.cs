namespace oDres.GeneradorReportes.WEBApi.Application.DTOs;

public class ModuleDto
{
    public Guid IdModulo { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public bool Administrador { get; set; }
    public DateTime FechaRegistro { get; set; }
    public DateTime FechaActualizacion { get; set; }
    public string Usuario { get; set; } = string.Empty;
    public string Programa { get; set; } = string.Empty;
    public bool Activo { get; set; }
    public List<ReportDto> Reportes { get; set; } = new();
}

public class ReportDto
{
    public Guid IdReporte { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string Titulo { get; set; } = string.Empty;
    public Guid IdModulo { get; set; }
    public string SentenciaSQL { get; set; } = string.Empty;
    public int TipoReporte { get; set; }
    public string ModuloNombre { get; set; } = string.Empty; // Computed property from relationship
}

public class ReportParameterDto
{
    public string Name { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string DataType { get; set; } = string.Empty;
    public bool IsRequired { get; set; }
    public object? DefaultValue { get; set; }
}

public class ReportResultDto
{
    public List<Dictionary<string, object?>> Data { get; set; } = new();
    public List<string> Columns { get; set; } = new();
    public List<ReportParameterDto> Parameters { get; set; } = new();
    public int TotalRecords { get; set; }
}
