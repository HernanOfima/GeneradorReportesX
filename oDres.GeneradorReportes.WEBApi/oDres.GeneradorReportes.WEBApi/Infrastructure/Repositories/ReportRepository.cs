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
        Console.WriteLine($"Report Type: {report.TipoReporte}");
        Console.WriteLine($"SQL Query: {report.SentenciaSQL}");
        Console.WriteLine($"Parameters received: {string.Join(", ", parameters.Select(p => $"{p.Key}={p.Value}"))}");

        var result = new ReportResult();
        
        using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();
        
        string commandText = report.SentenciaSQL;
        
        // For stored procedures, extract only the SP name (before first space or @)
        if (report.TipoReporte == 2)
        {
            // Extract SP name: "Empresa.spReporte_ResumenSaldoInventario @params..." -> "Empresa.spReporte_ResumenSaldoInventario"
            var spNameMatch = System.Text.RegularExpressions.Regex.Match(report.SentenciaSQL, @"^([^\s@]+)");
            if (spNameMatch.Success)
            {
                commandText = spNameMatch.Groups[1].Value.Trim();
                Console.WriteLine($"Extracted SP name: {commandText}");
            }
        }
        
        using var command = new SqlCommand(commandText, connection);
        
        // Set command type based on TipoReporte
        if (report.TipoReporte == 2)
        {
            command.CommandType = CommandType.StoredProcedure;
            Console.WriteLine("Executing as Stored Procedure");
        }
        else
        {
            command.CommandType = CommandType.Text;
            Console.WriteLine("Executing as SQL Query");
        }
        
        // Add parameters to the command
        foreach (var param in parameters)
        {
            var value = ConvertJsonElementToSqlValue(param.Value);
            var parameterName = param.Key;
            
            // For stored procedures, ensure parameter name starts with @
            if (report.TipoReporte == 2 && !parameterName.StartsWith("@"))
            {
                parameterName = $"@{parameterName}";
            }
            
            // Handle optional parameters (when value is null or empty for non-required parameters)
            if (value == null || (value is string str && string.IsNullOrWhiteSpace(str)))
            {
                command.Parameters.AddWithValue(parameterName, DBNull.Value);
                Console.WriteLine($"Added optional parameter: {parameterName} = NULL");
            }
            else
            {
                command.Parameters.AddWithValue(parameterName, value);
                Console.WriteLine($"Added parameter: {parameterName} = {value} (Type: {value?.GetType()})");
            }
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
                var columnName = row["ColumnName"].ToString() ?? "";
                result.Columns.Add(columnName);

                // Extract data type information
                var dataType = GetSqlDataTypeName(row);
                result.ColumnDataTypes.Add(new ReportColumn
                {
                    Name = columnName,
                    DataType = dataType
                });
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

    private static string GetSqlDataTypeName(DataRow schemaRow)
    {
        try
        {
            // Get the .NET type
            var dataType = (Type?)schemaRow["DataType"];
            if (dataType == null)
                return "String";

            // Map .NET types to SQL Server data types
            var typeMapping = new Dictionary<Type, string>
            {
                { typeof(string), "String" },
                { typeof(int), "Int32" },
                { typeof(long), "Int64" },
                { typeof(short), "Int16" },
                { typeof(byte), "Byte" },
                { typeof(bool), "Boolean" },
                { typeof(DateTime), "DateTime" },
                { typeof(decimal), "Decimal" },
                { typeof(double), "Double" },
                { typeof(float), "Single" },
                { typeof(Guid), "Guid" },
                { typeof(byte[]), "Binary" },
                { typeof(TimeSpan), "Time" },
                { typeof(DateTimeOffset), "DateTimeOffset" }
            };

            // Handle nullable types
            if (dataType.IsGenericType && dataType.GetGenericTypeDefinition() == typeof(Nullable<>))
            {
                dataType = Nullable.GetUnderlyingType(dataType) ?? dataType;
            }

            return typeMapping.TryGetValue(dataType, out var mappedType) ? mappedType : dataType.Name;
        }
        catch
        {
            return "String"; // Default fallback
        }
    }
}
