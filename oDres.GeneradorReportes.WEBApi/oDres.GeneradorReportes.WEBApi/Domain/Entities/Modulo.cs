namespace oDres.GeneradorReportes.WEBApi.Domain.Entities;

public class Modulo
{
    public Guid IdModulo { get; set; }
    public string? Nombre { get; set; }
    public bool? Administrador { get; set; }
    public DateTime? FechaRegistro { get; set; }
    public DateTime? FechaActualizacion { get; set; }
    public string? Usuario { get; set; }
    public string? Programa { get; set; }
    public bool? Activo { get; set; }

    public ICollection<Reporte> Reportes { get; set; } = new List<Reporte>();
}
