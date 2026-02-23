namespace oDres.GeneradorReportes.WEBApi.Domain.Models;

public class ReportParameter
{
    public string Name { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public Type DataType { get; set; } = typeof(string);
    public bool IsRequired { get; set; } = true;
    public object? DefaultValue { get; set; }
}

public class ReportResult
{
    public List<Dictionary<string, object?>> Data { get; set; } = new();
    public List<string> Columns { get; set; } = new();
    public List<ReportParameter> Parameters { get; set; } = new();
    public int TotalRecords { get; set; }
}

public class ExecuteReportRequest
{
    public Guid ReportId { get; set; }
    public Dictionary<string, object?> Parameters { get; set; } = new();
}
