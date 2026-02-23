using Microsoft.EntityFrameworkCore;
using oDres.GeneradorReportes.WEBApi.Domain.Entities;

namespace oDres.GeneradorReportes.WEBApi.Infrastructure.Data;

public class ReportDbContext : DbContext
{
    public ReportDbContext(DbContextOptions<ReportDbContext> options) : base(options)
    {
    }

    public DbSet<Modulo> Modulos { get; set; }
    public DbSet<Reporte> Reportes { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Configurar esquema por defecto
        modelBuilder.HasDefaultSchema("Catalogo");

        modelBuilder.Entity<Modulo>(entity =>
        {
            // Tabla: Modulo en esquema Catalogo
            entity.ToTable("Modulo", "Catalogo");
            
            entity.HasKey(e => e.IdModulo);
            entity.Property(e => e.IdModulo)
                .HasColumnName("IdModulo")
                .IsRequired();
            entity.Property(e => e.Nombre)
                .HasColumnName("Nombre")
                .HasMaxLength(50)
                .IsRequired(false);
            entity.Property(e => e.Administrador)
                .HasColumnName("Administrador")
                .IsRequired(false);
            entity.Property(e => e.FechaRegistro)
                .HasColumnName("FechaRegistro")
                .IsRequired(false);
            entity.Property(e => e.FechaActualizacion)
                .HasColumnName("FechaActualizacion")
                .IsRequired(false);
            entity.Property(e => e.Usuario)
                .HasColumnName("Usuario")
                .HasMaxLength(20)
                .IsRequired(false);
            entity.Property(e => e.Programa)
                .HasColumnName("Programa")
                .HasMaxLength(50)
                .IsRequired(false);
            entity.Property(e => e.Activo)
                .HasColumnName("Activo")
                .IsRequired(false);
        });

        modelBuilder.Entity<Reporte>(entity =>
        {
            // Tabla: Reportes en esquema Catalogo  
            entity.ToTable("Reportes", "Catalogo");
            
            entity.HasKey(e => e.IdReporte);
            entity.Property(e => e.IdReporte)
                .HasColumnName("IdReporte")
                .IsRequired();
            entity.Property(e => e.Nombre)
                .HasColumnName("Nombre")
                .HasMaxLength(100)
                .IsRequired(false);
            entity.Property(e => e.Titulo)
                .HasColumnName("Titulo")
                .HasMaxLength(200)
                .IsRequired(false);
            entity.Property(e => e.IdModulo)
                .HasColumnName("IdModulo")
                .IsRequired();
            entity.Property(e => e.SentenciaSQL)
                .HasColumnName("SentenciaSQL")
                .HasColumnType("varchar(MAX)")
                .IsRequired(false);
            
            entity.HasOne(d => d.Modulo)
                .WithMany(p => p.Reportes)
                .HasForeignKey(d => d.IdModulo)
                .OnDelete(DeleteBehavior.Restrict);
        });

        base.OnModelCreating(modelBuilder);
    }
}
