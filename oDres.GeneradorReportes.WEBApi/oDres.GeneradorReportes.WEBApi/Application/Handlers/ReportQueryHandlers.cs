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
        return _mapper.Map<IEnumerable<ModuleDto>>(modules);
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
        return module != null ? _mapper.Map<ModuleDto>(module) : null;
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
        return _mapper.Map<IEnumerable<ReportDto>>(reports);
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
