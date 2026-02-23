using Microsoft.EntityFrameworkCore;
using oDres.GeneradorReportes.WEBApi.Domain.Entities;
using oDres.GeneradorReportes.WEBApi.Domain.Interfaces;
using oDres.GeneradorReportes.WEBApi.Domain.Models;
using oDres.GeneradorReportes.WEBApi.Infrastructure.Data;
using oDres.GeneradorReportes.WEBApi.Infrastructure.Services;
using System.Data;
using System.Data.SqlClient;
using System.Text.Json;

namespace oDres.GeneradorReportes.WEBApi.Infrastructure.Repositories;

public class ReportRepository : IReportRepository
{
    private readonly ReportDbContext _context;
    private readonly string _connectionString;

    public ReportRepository(ReportDbContext context, IConfiguration configuration)
    {
        _context = context;
        _connectionString = configuration.GetConnectionString("DefaultConnection") ?? throw new ArgumentNullException(nameof(configuration));
    }

    public async Task<IEnumerable<Reporte>> GetAllReportsAsync()
    {
        return await _context.Reportes
            .Include(r => r.Modulo)
            .ToListAsync();
    }

    public async Task<IEnumerable<Reporte>> GetReportsByModuleAsync(Guid moduleId)
    {
        return await _context.Reportes
            .Include(r => r.Modulo)
            .Where(r => r.IdModulo == moduleId)
            .ToListAsync();
    }

    public async Task<Reporte?> GetReportByIdAsync(Guid id)
    {
        return await _context.Reportes
            .Include(r => r.Modulo)
            .FirstOrDefaultAsync(r => r.IdReporte == id);
    }

    public async Task<ReportResult> ExecuteReportAsync(Guid reportId, Dictionary<string, object?> parameters)
    {
        var report = await GetReportByIdAsync(reportId);
        if (report == null)
            throw new ArgumentException($"Report with ID {reportId} not found.");

        // Debug logging
        Console.WriteLine($"Report ID: {reportId}");
        Console.WriteLine($"Report Name: {report.Nombre}");
        Console.WriteLine($"SQL Query: {report.SentenciaSQL}");
        Console.WriteLine($"Parameters received: {string.Join(", ", parameters.Select(p => $"{p.Key}={p.Value}"))}");

        var result = new ReportResult();
        
        using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();
        
        using var command = new SqlCommand(report.SentenciaSQL, connection);
        
        // Add parameters to the command
        foreach (var param in parameters)
        {
            var value = ConvertJsonElementToSqlValue(param.Value);
            command.Parameters.AddWithValue(param.Key, value ?? DBNull.Value);
            Console.WriteLine($"Added parameter: {param.Key} = {value} (Type: {value?.GetType()})");
        }

        Console.WriteLine($"Final SQL Command: {command.CommandText}");
        Console.WriteLine($"Command Parameters: {string.Join(", ", command.Parameters.Cast<SqlParameter>().Select(p => $"{p.ParameterName}={p.Value}"))}");

        using var reader = await command.ExecuteReaderAsync();
        
        // Get column information
        var schemaTable = reader.GetSchemaTable();
        if (schemaTable != null)
        {
            foreach (DataRow row in schemaTable.Rows)
            {
                result.Columns.Add(row["ColumnName"].ToString() ?? "");
            }
        }

        // Read data
        while (await reader.ReadAsync())
        {
            var row = new Dictionary<string, object?>();
            for (int i = 0; i < reader.FieldCount; i++)
            {
                var value = reader.IsDBNull(i) ? null : reader.GetValue(i);
                row[reader.GetName(i)] = value;
            }
            result.Data.Add(row);
        }

        result.TotalRecords = result.Data.Count;
        result.Parameters = await AnalyzeReportParametersAsync(report.SentenciaSQL);

        Console.WriteLine($"Query executed successfully. Records returned: {result.TotalRecords}");
        Console.WriteLine($"Columns found: {string.Join(", ", result.Columns)}");

        return result;
    }

    public async Task<List<ReportParameter>> AnalyzeReportParametersAsync(string sqlQuery)
    {
        return await Task.FromResult(SqlParameterAnalyzer.AnalyzeParameters(sqlQuery));
    }

    private static object? ConvertJsonElementToSqlValue(object? value)
    {
        if (value == null) return null;

        // If it's already a JsonElement, convert it to the proper type
        if (value is JsonElement jsonElement)
        {
            return jsonElement.ValueKind switch
            {
                JsonValueKind.String => jsonElement.GetString(),
                JsonValueKind.Number => jsonElement.TryGetInt32(out int intVal) ? intVal :
                                      jsonElement.TryGetInt64(out long longVal) ? longVal :
                                      jsonElement.TryGetDecimal(out decimal decVal) ? decVal :
                                      jsonElement.GetDouble(),
                JsonValueKind.True => true,
                JsonValueKind.False => false,
                JsonValueKind.Null => null,
                JsonValueKind.Undefined => null,
                _ => jsonElement.ToString()
            };
        }

        // If it's a string that looks like a date, try to parse it
        if (value is string stringValue)
        {
            if (DateTime.TryParse(stringValue, out DateTime dateTime))
            {
                return dateTime;
            }
            if (Guid.TryParse(stringValue, out Guid guidValue))
            {
                return guidValue;
            }
        }

        // Return the value as-is for other types
        return value;
    }
}
