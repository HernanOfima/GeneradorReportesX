using oDres.GeneradorReportes.WEBApi.Application.DTOs;

namespace oDres.GeneradorReportes.WEBApi.Domain.Interfaces;

public interface IAnaliticaRepository
{
    Task<ContextoDatosDto> CargarContextoAsync(CargarContextoRequest request);
    Task<string> NombreCuentaAsync(string cuenta, string empresa);
    Task<decimal> SaldoCuentaAsync(string cuenta, int periodo, string acumulado, string empresa, int año);
    Task<decimal> SaldoDBCRAsync(string cuenta, int periodo, string naturaleza, string empresa, int año);
    Task<decimal> SaldoCuentaCadenaAsync(string cuentas, int periodo, string acumulado, string empresa, int año);
    Task<decimal> SaldoCuentaContableAsync(string cuentas, int periodo, string acumulado, string empresa, int año);
    Task<decimal> SaldoCuentaContableDBCRAsync(string cuenta, int periodo, string tipo, string empresa, int año);
    Task<List<PlantillaAnaliticaDto>> GetPlantillasAsync();
    Task<PlantillaAnaliticaDto?> GetPlantillaByIdAsync(string id);
    Task<PlantillaAnaliticaDto> GuardarPlantillaAsync(GuardarPlantillaRequest request);
    Task DeletePlantillaAsync(string id);
}
