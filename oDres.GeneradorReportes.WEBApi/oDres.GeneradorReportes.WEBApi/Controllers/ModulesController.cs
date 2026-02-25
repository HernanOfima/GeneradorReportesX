using MediatR;

using Microsoft.AspNetCore.Mvc;

using oDres.GeneradorReportes.WEBApi.Application.DTOs;

using oDres.GeneradorReportes.WEBApi.Application.Queries;

using Swashbuckle.AspNetCore.Annotations;



namespace oDres.GeneradorReportes.WEBApi.Controllers

{

    /// <summary>

    /// Controlador para la gestión de módulos de reportes

    /// </summary>

    [ApiController]

    [Route("api/[controller]")]

    [Produces("application/json")]

    [SwaggerTag("Gestión de módulos organizacionales para reportes")]

    public class ModulesController : ControllerBase

    {

        private readonly IMediator _mediator;



        public ModulesController(IMediator mediator)

        {

            _mediator = mediator;

        }



        /// <summary>

        /// Obtiene todos los módulos disponibles en el sistema

        /// </summary>

        /// <returns>Lista completa de módulos con sus reportes asociados</returns>

        /// <response code="200">Lista de módulos obtenida exitosamente</response>

        /// <response code="500">Error interno del servidor</response>

        [HttpGet]

        [SwaggerOperation(Summary = "Obtener todos los módulos", Description = "Retorna la lista completa de módulos disponibles en el sistema con información de reportes")]

        [SwaggerResponse(200, "Módulos obtenidos exitosamente", typeof(IEnumerable<ModuleDto>))]

        [SwaggerResponse(500, "Error interno del servidor")]

        public async Task<ActionResult<IEnumerable<ModuleDto>>> GetAllModules()

        {

            var modules = await _mediator.Send(new GetAllModulesQuery());

            return Ok(modules);

        }



        /// <summary>

        /// Obtiene un módulo específico por su ID

        /// </summary>

        /// <param name="id">Identificador único del módulo</param>

        /// <returns>Información detallada del módulo</returns>

        /// <response code="200">Módulo encontrado</response>

        /// <response code="404">Módulo no encontrado</response>

        /// <response code="500">Error interno del servidor</response>

        [HttpGet("{id:int}")]

        [SwaggerOperation(Summary = "Obtener módulo por ID", Description = "Retorna la información completa de un módulo específico")]

        [SwaggerResponse(200, "Módulo encontrado", typeof(ModuleDto))]

        [SwaggerResponse(404, "Módulo no encontrado")]

        [SwaggerResponse(500, "Error interno del servidor")]

        public async Task<ActionResult<ModuleDto>> GetModuleById(

            [SwaggerParameter("ID único del módulo", Required = true)] int id)

        {

            var module = await _mediator.Send(new GetModuleByIdQuery(id));

            if (module == null)

                return NotFound($"Módulo con ID '{id}' no fue encontrado");

            

            return Ok(module);

        }



        /// <summary>

        /// Obtiene todos los reportes asociados a un módulo específico

        /// </summary>

        /// <param name="id">Identificador del módulo</param>

        /// <returns>Lista de reportes del módulo</returns>

        /// <response code="200">Reportes obtenidos exitosamente</response>

        /// <response code="404">Módulo no encontrado</response>

        /// <response code="500">Error interno del servidor</response>

        [HttpGet("{id:guid}/reports")]

        [SwaggerOperation(Summary = "Obtener reportes de un módulo", Description = "Retorna todos los reportes asociados al módulo especificado")]

        [SwaggerResponse(200, "Reportes obtenidos exitosamente", typeof(IEnumerable<ReportDto>))]

        [SwaggerResponse(404, "Módulo no encontrado")]

        [SwaggerResponse(500, "Error interno del servidor")]

        public async Task<ActionResult<IEnumerable<ReportDto>>> GetModuleReports(

            [SwaggerParameter("ID del módulo del cual obtener reportes", Required = true)] Guid id)

        {

            var reports = await _mediator.Send(new GetReportsByModuleQuery(id));

            return Ok(reports);

        }

    }

}

