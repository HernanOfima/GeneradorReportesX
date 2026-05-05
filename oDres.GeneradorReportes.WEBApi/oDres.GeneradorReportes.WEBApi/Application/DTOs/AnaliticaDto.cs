namespace oDres.GeneradorReportes.WEBApi.Application.DTOs;

public class CargarContextoRequest
{
    public string? IdEmpresa { get; set; }
    public int? Anio1 { get; set; }
    public int? Anio2 { get; set; }       // opcional — si null se usa Anio1
    public int? MesInicial { get; set; }
    public int? MesFinal { get; set; }    // opcional — si null se usa MesInicial
    public string? Acumulado { get; set; }
    public List<string> Cuentas { get; set; } = new();
    public List<string> Cadenas { get; set; } = new();
}

public class ContextoDatosDto
{
    public Dictionary<string, string> NombresCuentas { get; set; } = new();
    public Dictionary<string, decimal> SaldosIniciales { get; set; } = new();
    public Dictionary<string, decimal> SaldosFinales { get; set; } = new();
    public Dictionary<string, decimal> Debitos { get; set; } = new();
    public Dictionary<string, decimal> Creditos { get; set; } = new();
    public Dictionary<string, decimal> SaldosCadenaInicial { get; set; } = new();
    public Dictionary<string, decimal> SaldosCadenaFinal { get; set; } = new();
    public Dictionary<string, decimal> SaldosMensuales { get; set; } = new();
}

public class GuardarPlantillaRequest
{
    public string? Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string Descripcion { get; set; } = string.Empty;
    public string Contenido { get; set; } = string.Empty;
}

public class PlantillaAnaliticaDto
{
    public string Id { get; set; } = string.Empty;
    public string Nombre { get; set; } = string.Empty;
    public string Descripcion { get; set; } = string.Empty;
    public string Contenido { get; set; } = string.Empty;
    public DateTime FechaActualizacion { get; set; }
}
