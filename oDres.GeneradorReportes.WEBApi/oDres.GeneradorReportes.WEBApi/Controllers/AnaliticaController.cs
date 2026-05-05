using Microsoft.AspNetCore.Mvc;
using oDres.GeneradorReportes.WEBApi.Application.DTOs;
using oDres.GeneradorReportes.WEBApi.Domain.Interfaces;

namespace oDres.GeneradorReportes.WEBApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AnaliticaController : ControllerBase
{
    private readonly IAnaliticaRepository _repo;

    public AnaliticaController(IAnaliticaRepository repo)
    {
        _repo = repo;
    }

    // ─────────────────────────────────────────────────────────────────
    // POST /api/Analitica/CargarContexto
    // Carga todos los datos necesarios para evaluar fórmulas del spreadsheet
    // ─────────────────────────────────────────────────────────────────
    [HttpPost("CargarContexto")]
    public async Task<ActionResult<ContextoDatosDto>> CargarContexto([FromBody] CargarContextoRequest request)
    {
        request.IdEmpresa = request.IdEmpresa?.Trim();

        if (string.IsNullOrWhiteSpace(request.IdEmpresa))
            return BadRequest("El campo IdEmpresa es requerido.");

        if (!Guid.TryParse(request.IdEmpresa, out _))
            return BadRequest("El campo IdEmpresa debe ser un GUID valido.");

        if (!request.Cuentas.Any() && !request.Cadenas.Any())
            return BadRequest("Debe especificar al menos una cuenta o cadena de cuentas.");

        var contexto = await _repo.CargarContextoAsync(request);
        return Ok(contexto);
    }

    // ─────────────────────────────────────────────────────────────────
    // GET /api/Analitica/NombreCuenta?cuenta=11&empresa=TODOTERRENO2026
    // Equivalente a: NOMBRECTA(cuenta, empresa)
    // ─────────────────────────────────────────────────────────────────
    [HttpGet("NombreCuenta")]
    public async Task<ActionResult<string>> NombreCuenta([FromQuery] string cuenta, [FromQuery] string empresa)
    {
        var nombre = await _repo.NombreCuentaAsync(cuenta, empresa);
        return Ok(nombre);
    }

    // ─────────────────────────────────────────────────────────────────
    // GET /api/Analitica/SaldoCuenta?cuenta=11&periodo=4&acumulado=A&empresa=...&año=2023
    // Equivalente a: SALDOCONTABLECUENTA(cuenta, periodo, acumulado, empresa, año)
    // ─────────────────────────────────────────────────────────────────
    [HttpGet("SaldoCuenta")]
    public async Task<ActionResult<decimal>> SaldoCuenta(
        [FromQuery] string cuenta,
        [FromQuery] int periodo,
        [FromQuery] string acumulado,
        [FromQuery] string empresa,
        [FromQuery] int año)
    {
        var saldo = await _repo.SaldoCuentaAsync(cuenta, periodo, acumulado, empresa, año);
        return Ok(saldo);
    }

    // ─────────────────────────────────────────────────────────────────
    // GET /api/Analitica/SaldoDBCR?cuenta=11&periodo=4&naturaleza=DB&empresa=...&año=2023
    // Equivalente a: SaldoContableCtaDBCR(cuenta, periodo, naturaleza, empresa, año)
    // ─────────────────────────────────────────────────────────────────
    [HttpGet("SaldoDBCR")]
    public async Task<ActionResult<decimal>> SaldoDBCR(
        [FromQuery] string cuenta,
        [FromQuery] int periodo,
        [FromQuery] string naturaleza,
        [FromQuery] string empresa,
        [FromQuery] int año)
    {
        var saldo = await _repo.SaldoDBCRAsync(cuenta, periodo, naturaleza, empresa, año);
        return Ok(saldo);
    }

    // ─────────────────────────────────────────────────────────────────
    // GET /api/Analitica/SaldoCadena?cuentas=1,2,3&periodo=4&...
    // Equivalente a: SaldoContableCuentaCadena("1,2,3", ...)
    // ─────────────────────────────────────────────────────────────────
    [HttpGet("SaldoCadena")]
    public async Task<ActionResult<decimal>> SaldoCadena(
        [FromQuery] string cuentas,
        [FromQuery] int periodo,
        [FromQuery] string acumulado,
        [FromQuery] string empresa,
        [FromQuery] int año)
    {
        var saldo = await _repo.SaldoCuentaCadenaAsync(cuentas, periodo, acumulado, empresa, año);
        return Ok(saldo);
    }

    // ─────────────────────────────────────────────────────────────────
    // GET /api/Analitica/SaldoCuentaContable?cuentas=11,13-15,22&periodo=4&acumulado=A&empresa=...&año=2023
    // Equivalente a: VBS SaldoCuentaContable (soporta comas y rangos con guión)
    // ─────────────────────────────────────────────────────────────────
    [HttpGet("SaldoCuentaContable")]
    public async Task<ActionResult<decimal>> SaldoCuentaContable(
        [FromQuery] string cuentas,
        [FromQuery] int periodo,
        [FromQuery] string acumulado,
        [FromQuery] string empresa,
        [FromQuery] int año)
    {
        var saldo = await _repo.SaldoCuentaContableAsync(cuentas, periodo, acumulado, empresa, año);
        return Ok(saldo);
    }

    // ─────────────────────────────────────────────────────────────────
    // GET /api/Analitica/SaldoCuentaContableDBCR?cuenta=11&periodo=4&tipo=DB&empresa=...&año=2023
    // Equivalente a: VBS SaldoCuentaContableDBCR (siempre mensual, DB o CR)
    // ─────────────────────────────────────────────────────────────────
    [HttpGet("SaldoCuentaContableDBCR")]
    public async Task<ActionResult<decimal>> SaldoCuentaContableDBCR(
        [FromQuery] string cuenta,
        [FromQuery] int periodo,
        [FromQuery] string tipo,
        [FromQuery] string empresa,
        [FromQuery] int año)
    {
        var saldo = await _repo.SaldoCuentaContableDBCRAsync(cuenta, periodo, tipo, empresa, año);
        return Ok(saldo);
    }

    // ─────────────────────────────────────────────────────────────────
    // GESTIÓN DE PLANTILLAS
    // ─────────────────────────────────────────────────────────────────
    [HttpGet("Plantillas")]
    public async Task<ActionResult<List<PlantillaAnaliticaDto>>> GetPlantillas()
    {
        var lista = await _repo.GetPlantillasAsync();
        return Ok(lista);
    }

    [HttpGet("Plantillas/{id}")]
    public async Task<ActionResult<PlantillaAnaliticaDto>> GetPlantilla(string id)
    {
        var plantilla = await _repo.GetPlantillaByIdAsync(id);
        if (plantilla == null) return NotFound();
        return Ok(plantilla);
    }

    [HttpPost("Plantillas")]
    public async Task<ActionResult<PlantillaAnaliticaDto>> GuardarPlantilla([FromBody] GuardarPlantillaRequest request)
    {
        if (string.IsNullOrEmpty(request.Nombre))
            return BadRequest("El nombre de la plantilla es requerido.");

        var plantilla = await _repo.GuardarPlantillaAsync(request);
        return Ok(plantilla);
    }

    [HttpDelete("Plantillas/{id}")]
    public async Task<IActionResult> DeletePlantilla(string id)
    {
        await _repo.DeletePlantillaAsync(id);
        return NoContent();
    }
}
