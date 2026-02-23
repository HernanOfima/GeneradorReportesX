using oDres.GeneradorReportes.WEBApi.Domain.Entities;
using oDres.GeneradorReportes.WEBApi.Domain.Models;

namespace oDres.GeneradorReportes.WEBApi.Domain.Interfaces;

public interface IReportRepository
{
    Task<IEnumerable<Reporte>> GetAllReportsAsync();
    Task<IEnumerable<Reporte>> GetReportsByModuleAsync(Guid moduleId);
    Task<Reporte?> GetReportByIdAsync(Guid id);
    Task<ReportResult> ExecuteReportAsync(Guid reportId, Dictionary<string, object?> parameters);
    Task<List<ReportParameter>> AnalyzeReportParametersAsync(string sqlQuery);
}
