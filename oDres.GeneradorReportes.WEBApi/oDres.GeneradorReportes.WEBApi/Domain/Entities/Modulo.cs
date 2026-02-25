using System.ComponentModel.DataAnnotations;

namespace oDres.GeneradorReportes.WEBApi.Domain.Entities;

public class Modulo
{
    [Key]
    public Guid IdModulo { get; set; } = Guid.NewGuid();
    
    [StringLength(50)]
    public string? Nombre { get; set; } = string.Empty;
    
    public bool? Administrador { get; set; }
    
    public DateTime? FechaRegistro { get; set; }
    
    public DateTime? FechaActualizacion { get; set; }
    
    [StringLength(20)]
    public string? Usuario { get; set; }
    
    [StringLength(50)]
    public string? Programa { get; set; }
    
    public bool? Activo { get; set; } = true;
    
    // Relación uno a muchos con Reportes
    public virtual ICollection<Reporte> Reportes { get; set; } = new List<Reporte>();
}
