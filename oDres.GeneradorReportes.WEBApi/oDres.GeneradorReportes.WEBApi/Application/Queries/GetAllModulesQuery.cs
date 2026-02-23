using MediatR;
using oDres.GeneradorReportes.WEBApi.Application.DTOs;

namespace oDres.GeneradorReportes.WEBApi.Application.Queries;

public record GetAllModulesQuery : IRequest<IEnumerable<ModuleDto>>;

public record GetModuleByIdQuery(Guid Id) : IRequest<ModuleDto?>;

public record GetReportsByModuleQuery(Guid ModuleId) : IRequest<IEnumerable<ReportDto>>;

public record GetReportByIdQuery(Guid Id) : IRequest<ReportDto?>;

public record AnalyzeReportParametersQuery(string SqlQuery) : IRequest<List<ReportParameterDto>>;

public record ExecuteReportQuery(Guid ReportId, Dictionary<string, object?> Parameters) : IRequest<ReportResultDto>;
