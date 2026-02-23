using Microsoft.EntityFrameworkCore;
using oDres.GeneradorReportes.WEBApi.Domain.Entities;
using oDres.GeneradorReportes.WEBApi.Domain.Interfaces;
using oDres.GeneradorReportes.WEBApi.Infrastructure.Data;

namespace oDres.GeneradorReportes.WEBApi.Infrastructure.Repositories;

public class ModuleRepository : IModuleRepository
{
    private readonly ReportDbContext _context;

    public ModuleRepository(ReportDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<Modulo>> GetAllModulesAsync()
    {
        return await _context.Modulos
            .Where(m => m.Activo == true)
            .Include(m => m.Reportes)
            .ToListAsync();
    }

    public async Task<Modulo?> GetModuleByIdAsync(Guid id)
    {
        return await _context.Modulos
            .Include(m => m.Reportes)
            .FirstOrDefaultAsync(m => m.IdModulo == id);
    }

    public async Task<Modulo> AddModuleAsync(Modulo module)
    {
        if (module.IdModulo == Guid.Empty)
        {
            module.IdModulo = Guid.NewGuid();
        }
        module.FechaRegistro = DateTime.UtcNow;
        module.FechaActualizacion = DateTime.UtcNow;
        
        _context.Modulos.Add(module);
        await _context.SaveChangesAsync();
        return module;
    }

    public async Task<Modulo> UpdateModuleAsync(Modulo module)
    {
        module.FechaActualizacion = DateTime.UtcNow;
        _context.Modulos.Update(module);
        await _context.SaveChangesAsync();
        return module;
    }

    public async Task DeleteModuleAsync(Guid id)
    {
        var module = await GetModuleByIdAsync(id);
        if (module != null)
        {
            module.Activo = false;
            module.FechaActualizacion = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }
    }
}
