using System.ComponentModel.DataAnnotations;

namespace oDres.GeneradorReportes.WEBApi.Domain.Entities;

public class Modulo
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();
    
    [Required]
    [StringLength(100)]
    public string Nombre { get; set; } = string.Empty;
    
    [StringLength(500)]
    public string? Descripcion { get; set; }
    
    public bool Activo { get; set; } = true;
    
    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;
    
    public DateTime? FechaModificacion { get; set; }
    
    // Relación uno a muchos con Reportes
    public virtual ICollection<Reporte> Reportes { get; set; } = new List<Reporte>();
}
