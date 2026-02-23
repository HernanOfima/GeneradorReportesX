using oDres.GeneradorReportes.WEBApi.Domain.Entities;

namespace oDres.GeneradorReportes.WEBApi.Domain.Interfaces;

public interface IModuleRepository
{
    Task<IEnumerable<Modulo>> GetAllModulesAsync();
    Task<Modulo?> GetModuleByIdAsync(Guid id);
    Task<Modulo> AddModuleAsync(Modulo module);
    Task<Modulo> UpdateModuleAsync(Modulo module);
    Task DeleteModuleAsync(Guid id);
}
