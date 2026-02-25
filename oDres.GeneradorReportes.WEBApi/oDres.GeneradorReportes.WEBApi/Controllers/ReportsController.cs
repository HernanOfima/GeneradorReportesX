using MediatR;

using Microsoft.AspNetCore.Mvc;

using oDres.GeneradorReportes.WEBApi.Application.DTOs;

using oDres.GeneradorReportes.WEBApi.Application.Queries;

using oDres.GeneradorReportes.WEBApi.Domain.Models;

using Swashbuckle.AspNetCore.Annotations;



namespace oDres.GeneradorReportes.WEBApi.Controllers

{

    /// <summary>

    /// Controlador principal para la gestión y ejecución de reportes

    /// </summary>

    [ApiController]

    [Route("api/[controller]")]

    [Produces("application/json")]

    [SwaggerTag("Gestión, análisis y ejecución de reportes dinámicos")]

    public class ReportsController : ControllerBase

    {

        private readonly IMediator _mediator;



        public ReportsController(IMediator mediator)

        {

            _mediator = mediator;

        }



        /// <summary>

        /// Obtiene todos los reportes disponibles en el sistema

        /// </summary>

        /// <returns>Lista completa de reportes de todos los módulos</returns>

        /// <response code="200">Reportes obtenidos exitosamente</response>

        /// <response code="500">Error interno del servidor</response>

        [HttpGet]

        [SwaggerOperation(Summary = "Obtener todos los reportes", Description = "Retorna la lista completa de reportes disponibles en todos los módulos del sistema")]

        [SwaggerResponse(200, "Reportes obtenidos exitosamente", typeof(IEnumerable<ReportDto>))]

        [SwaggerResponse(500, "Error interno del servidor")]

        public async Task<ActionResult<IEnumerable<ReportDto>>> GetAllReports()

        {

            var modules = await _mediator.Send(new GetAllModulesQuery());

            var reports = modules.SelectMany(m => m.Reportes);

            return Ok(reports);

        }



        /// <summary>

        /// Obtiene un reporte específico por su ID

        /// </summary>

        /// <param name="id">Identificador único del reporte</param>

        /// <returns>Información detallada del reporte</returns>

        /// <response code="200">Reporte encontrado</response>

        /// <response code="404">Reporte no encontrado</response>

        /// <response code="500">Error interno del servidor</response>

        [HttpGet("{id:int}")]

        [SwaggerOperation(Summary = "Obtener reporte por ID", Description = "Retorna la información completa de un reporte específico incluyendo su consulta SQL")]

        [SwaggerResponse(200, "Reporte encontrado", typeof(ReportDto))]

        [SwaggerResponse(404, "Reporte no encontrado")]

        [SwaggerResponse(500, "Error interno del servidor")]

        public async Task<ActionResult<ReportDto>> GetReportById(

            [SwaggerParameter("ID único del reporte", Required = true)] int id)

        {

            var report = await _mediator.Send(new GetReportByIdQuery(id));

            if (report == null)

                return NotFound($"Reporte con ID '{id}' no fue encontrado");

            

            return Ok(report);

        }



        /// <summary>

        /// Obtiene todos los reportes asociados a un módulo específico

        /// </summary>

        /// <param name="moduleId">Identificador del módulo</param>

        /// <returns>Lista de reportes del módulo</returns>

        /// <response code="200">Reportes obtenidos exitosamente</response>

        /// <response code="404">Módulo no encontrado</response>

        /// <response code="500">Error interno del servidor</response>

        [HttpGet("module/{moduleId:int}")]

        [SwaggerOperation(Summary = "Obtener reportes de un módulo", Description = "Retorna todos los reportes asociados al módulo especificado")]

        [SwaggerResponse(200, "Reportes obtenidos exitosamente", typeof(IEnumerable<ReportDto>))]

        [SwaggerResponse(404, "Módulo no encontrado")]

        [SwaggerResponse(500, "Error interno del servidor")]

        public async Task<ActionResult<IEnumerable<ReportDto>>> GetReportsByModule(

            [SwaggerParameter("ID del módulo del cual obtener reportes", Required = true)] int moduleId)

        {

            var reports = await _mediator.Send(new GetReportsByModuleQuery(moduleId));

            return Ok(reports);

        }



        /// <summary>

        /// Analiza una consulta SQL para identificar parámetros requeridos

        /// </summary>

        /// <param name="sqlQuery">Consulta SQL a analizar</param>

        /// <returns>Lista de parámetros detectados con sus tipos y propiedades</returns>

        /// <response code="200">Parámetros analizados exitosamente</response>

        /// <response code="400">Consulta SQL inválida</response>

        /// <response code="500">Error interno del servidor</response>

        [HttpPost("analyze-parameters")]

        [SwaggerOperation(Summary = "Analizar parámetros SQL", Description = "Analiza una consulta SQL y detecta automáticamente los parámetros requeridos")]

        [SwaggerResponse(200, "Parámetros analizados exitosamente", typeof(List<ReportParameterDto>))]

        [SwaggerResponse(400, "Consulta SQL inválida")]

        [SwaggerResponse(500, "Error interno del servidor")]

        public async Task<ActionResult<List<ReportParameterDto>>> AnalyzeParameters(

            [FromBody, SwaggerParameter("Consulta SQL para analizar parámetros", Required = true)] string sqlQuery)

        {

            var parameters = await _mediator.Send(new AnalyzeReportParametersQuery(sqlQuery));

            return Ok(parameters);

        }



        /// <summary>

        /// Ejecuta un reporte con los parámetros especificados

        /// </summary>

        /// <param name="request">Solicitud de ejecución con ID del reporte y parámetros</param>

        /// <returns>Resultado de la ejecución del reporte con datos y metadatos</returns>

        /// <response code="200">Reporte ejecutado exitosamente</response>

        /// <response code="400">Parámetros inválidos o faltantes</response>

        /// <response code="404">Reporte no encontrado</response>

        /// <response code="500">Error en la ejecución del reporte</response>

        [HttpPost("execute")]

        [SwaggerOperation(Summary = "Ejecutar reporte", Description = "Ejecuta un reporte específico con los parámetros proporcionados y retorna los resultados")]

        [SwaggerResponse(200, "Reporte ejecutado exitosamente", typeof(ReportResultDto))]

        [SwaggerResponse(400, "Parámetros inválidos o faltantes")]

        [SwaggerResponse(404, "Reporte no encontrado")]

        [SwaggerResponse(500, "Error en la ejecución del reporte")]

        public async Task<ActionResult<ReportResultDto>> ExecuteReport(

            [FromBody, SwaggerParameter("Datos de ejecución del reporte incluyendo ID y parámetros", Required = true)] ExecuteReportRequest request)

        {

            try

            {

                var result = await _mediator.Send(new ExecuteReportQuery(request.ReportId, request.Parameters));

                return Ok(result);

            }

            catch (ArgumentException ex)

            {

                return BadRequest(ex.Message);

            }

            catch (Exception ex)

            {

                return StatusCode(500, $"Error executing report: {ex.Message}");

            }

        }



        /// <summary>

        /// Obtiene los parámetros requeridos para un reporte específico

        /// </summary>

        /// <param name="id">Identificador único del reporte</param>

        /// <returns>Lista de parámetros requeridos por el reporte</returns>

        /// <response code="200">Parámetros obtenidos exitosamente</response>

        /// <response code="404">Reporte no encontrado</response>

        /// <response code="500">Error interno del servidor</response>

        [HttpGet("{id:int}/parameters")]

        [SwaggerOperation(Summary = "Obtener parámetros de un reporte", Description = "Analiza un reporte específico y retorna los parámetros que requiere")]

        [SwaggerResponse(200, "Parámetros obtenidos exitosamente", typeof(List<ReportParameterDto>))]

        [SwaggerResponse(404, "Reporte no encontrado")]

        [SwaggerResponse(500, "Error interno del servidor")]

        public async Task<ActionResult<List<ReportParameterDto>>> GetReportParameters(

            [SwaggerParameter("ID único del reporte", Required = true)] int id)

        {

            var report = await _mediator.Send(new GetReportByIdQuery(id));

            if (report == null)

                return NotFound($"Reporte con ID '{id}' no fue encontrado");



            var parameters = await _mediator.Send(new AnalyzeReportParametersQuery(report.SentenciaSQL));

            return Ok(parameters);

        }

    }

}



/// <summary>

/// Modelo de solicitud para ejecutar un reporte

/// </summary>

public class ExecuteReportRequest

{

    /// <summary>

    /// Identificador único del reporte a ejecutar

    /// </summary>

    public int ReportId { get; set; }

    

    /// <summary>

    /// Diccionario de parámetros requeridos por el reporte

    /// </summary>

    public Dictionary<string, object?> Parameters { get; set; } = new();

}

