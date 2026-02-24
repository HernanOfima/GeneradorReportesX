namespace oDres.GeneradorReportes.WEBApi.Domain.Entities;

public class Reporte
{
    public Guid IdReporte { get; set; }
    public string? Nombre { get; set; }
    public string? Titulo { get; set; }
    public Guid IdModulo { get; set; }
    public string? SentenciaSQL { get; set; }
    public int TipoReporte { get; set; }

    public Modulo? Modulo { get; set; }
}
