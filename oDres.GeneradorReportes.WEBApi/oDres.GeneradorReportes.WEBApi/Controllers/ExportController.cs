using MediatR;
using Microsoft.AspNetCore.Mvc;
using oDres.GeneradorReportes.WEBApi.Application.Queries;
using oDres.GeneradorReportes.WEBApi.Infrastructure.Services;
using Swashbuckle.AspNetCore.Annotations;

namespace oDres.GeneradorReportes.WEBApi.Controllers;

/// <summary>
/// Controlador para funcionalidades de exportación de reportes
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
[SwaggerTag("Exportación de reportes en diferentes formatos")]
public class ExportController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ExcelExportService _excelExportService;

    public ExportController(IMediator mediator, ExcelExportService excelExportService)
    {
        _mediator = mediator;
        _excelExportService = excelExportService;
    }

    /// <summary>
    /// Exporta un reporte a formato Excel (.xlsx)
    /// </summary>
    /// <param name="request">Solicitud de exportación con ID del reporte y parámetros</param>
    /// <returns>Archivo Excel con los datos del reporte</returns>
    /// <response code="200">Archivo Excel generado exitosamente</response>
    /// <response code="400">Error en los parámetros o generación del archivo</response>
    /// <response code="404">Reporte no encontrado</response>
    /// <response code="500">Error interno del servidor</response>
    [HttpPost("excel")]
    [SwaggerOperation(
        Summary = "Exportar reporte a Excel", 
        Description = "Ejecuta un reporte específico y genera un archivo Excel con los resultados")]
    [SwaggerResponse(200, "Archivo Excel generado exitosamente", typeof(FileResult))]
    [SwaggerResponse(400, "Error en los parámetros o generación del archivo")]
    [SwaggerResponse(404, "Reporte no encontrado")]
    [SwaggerResponse(500, "Error interno del servidor")]
    [Produces("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")]
    public async Task<IActionResult> ExportToExcel(
        [FromBody, SwaggerParameter("Solicitud de exportación incluyendo ID del reporte y parámetros", Required = true)] ExportRequest request)
    {
        try
        {
            var reportResult = await _mediator.Send(new ExecuteReportQuery(request.ReportId, request.Parameters));
            var report = await _mediator.Send(new GetReportByIdQuery(request.ReportId));
            
            if (report == null)
                return NotFound("Report not found");

            var excelData = _excelExportService.ExportToExcel(
                new Domain.Models.ReportResult 
                {
                    Data = reportResult.Data,
                    Columns = reportResult.Columns,
                    TotalRecords = reportResult.TotalRecords
                }, 
                report.Titulo);

            var fileName = $"{report.Titulo}_{DateTime.Now:yyyyMMdd_HHmmss}.xlsx";
            
            return File(excelData, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Error exporting to Excel: {ex.Message}");
        }
    }
}

public class ExportRequest
{
    public Guid ReportId { get; set; }
    public Dictionary<string, object?> Parameters { get; set; } = new();
}
