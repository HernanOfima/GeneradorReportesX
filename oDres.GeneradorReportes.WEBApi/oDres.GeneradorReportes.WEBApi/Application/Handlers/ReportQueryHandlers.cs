using AutoMapper;
using MediatR;
using oDres.GeneradorReportes.WEBApi.Application.DTOs;
using oDres.GeneradorReportes.WEBApi.Application.Queries;
using oDres.GeneradorReportes.WEBApi.Domain.Interfaces;

namespace oDres.GeneradorReportes.WEBApi.Application.Handlers;

public class GetAllModulesQueryHandler : IRequestHandler<GetAllModulesQuery, IEnumerable<ModuleDto>>
{
    private readonly IModuleRepository _moduleRepository;
    private readonly IMapper _mapper;

    public GetAllModulesQueryHandler(IModuleRepository moduleRepository, IMapper mapper)
    {
        _moduleRepository = moduleRepository;
        _mapper = mapper;
    }

    public async Task<IEnumerable<ModuleDto>> Handle(GetAllModulesQuery request, CancellationToken cancellationToken)
    {
        var modules = await _moduleRepository.GetAllModulesAsync();
        var moduleDtos = _mapper.Map<List<ModuleDto>>(modules);

        foreach (var module in moduleDtos)
        {
            module.Reportes = module.Reportes.OrderForDisplay().ToList();
        }

        return moduleDtos;
    }
}

public class GetModuleByIdQueryHandler : IRequestHandler<GetModuleByIdQuery, ModuleDto?>
{
    private readonly IModuleRepository _moduleRepository;
    private readonly IMapper _mapper;

    public GetModuleByIdQueryHandler(IModuleRepository moduleRepository, IMapper mapper)
    {
        _moduleRepository = moduleRepository;
        _mapper = mapper;
    }

    public async Task<ModuleDto?> Handle(GetModuleByIdQuery request, CancellationToken cancellationToken)
    {
        var module = await _moduleRepository.GetModuleByIdAsync(request.Id);
        if (module == null)
        {
            return null;
        }

        var moduleDto = _mapper.Map<ModuleDto>(module);
        moduleDto.Reportes = moduleDto.Reportes.OrderForDisplay().ToList();
        return moduleDto;
    }
}

public class GetReportsByModuleQueryHandler : IRequestHandler<GetReportsByModuleQuery, IEnumerable<ReportDto>>
{
    private readonly IReportRepository _reportRepository;
    private readonly IMapper _mapper;

    public GetReportsByModuleQueryHandler(IReportRepository reportRepository, IMapper mapper)
    {
        _reportRepository = reportRepository;
        _mapper = mapper;
    }

    public async Task<IEnumerable<ReportDto>> Handle(GetReportsByModuleQuery request, CancellationToken cancellationToken)
    {
        var reports = await _reportRepository.GetReportsByModuleAsync(request.ModuleId);
        var reportDtos = _mapper.Map<List<ReportDto>>(reports);
        return reportDtos.OrderForDisplay();
    }
}

public class GetReportByIdQueryHandler : IRequestHandler<GetReportByIdQuery, ReportDto?>
{
    private readonly IReportRepository _reportRepository;
    private readonly IMapper _mapper;

    public GetReportByIdQueryHandler(IReportRepository reportRepository, IMapper mapper)
    {
        _reportRepository = reportRepository;
        _mapper = mapper;
    }

    public async Task<ReportDto?> Handle(GetReportByIdQuery request, CancellationToken cancellationToken)
    {
        var report = await _reportRepository.GetReportByIdAsync(request.Id);
        return report != null ? _mapper.Map<ReportDto>(report) : null;
    }
}

public class AnalyzeReportParametersQueryHandler : IRequestHandler<AnalyzeReportParametersQuery, List<ReportParameterDto>>
{
    private readonly IReportRepository _reportRepository;
    private readonly IMapper _mapper;

    public AnalyzeReportParametersQueryHandler(IReportRepository reportRepository, IMapper mapper)
    {
        _reportRepository = reportRepository;
        _mapper = mapper;
    }

    public async Task<List<ReportParameterDto>> Handle(AnalyzeReportParametersQuery request, CancellationToken cancellationToken)
    {
        var parameters = await _reportRepository.AnalyzeReportParametersAsync(request.SqlQuery);
        return _mapper.Map<List<ReportParameterDto>>(parameters);
    }
}

public class ExecuteReportQueryHandler : IRequestHandler<ExecuteReportQuery, ReportResultDto>
{
    private readonly IReportRepository _reportRepository;
    private readonly IMapper _mapper;

    public ExecuteReportQueryHandler(IReportRepository reportRepository, IMapper mapper)
    {
        _reportRepository = reportRepository;
        _mapper = mapper;
    }

    public async Task<ReportResultDto> Handle(ExecuteReportQuery request, CancellationToken cancellationToken)
    {
        var result = await _reportRepository.ExecuteReportAsync(request.ReportId, request.Parameters);
        return _mapper.Map<ReportResultDto>(result);
    }
}

internal static class ReportOrderingExtensions
{
    internal static IEnumerable<ReportDto> OrderForDisplay(this IEnumerable<ReportDto> reports)
    {
        if (reports == null)
        {
            return Enumerable.Empty<ReportDto>();
        }

        return reports
            .OrderBy(report => report.OrdenMostrar ?? int.MaxValue)
            .ThenBy(report => report.Titulo ?? string.Empty)
            .ThenBy(report => report.Nombre ?? string.Empty);
    }
}
