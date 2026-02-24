using oDres.GeneradorReportes.WEBApi.Domain.Models;
using System.Text.RegularExpressions;

namespace oDres.GeneradorReportes.WEBApi.Infrastructure.Services;

public class SqlParameterAnalyzer
{
    private static readonly Regex ParameterRegex = new(@"@(\w+)", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex OptionalParameterRegex = new(@"@(\w+)\s*=\s*Null", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    
    public static List<ReportParameter> AnalyzeParameters(string sqlQuery)
    {
        if (string.IsNullOrWhiteSpace(sqlQuery))
            return new List<ReportParameter>();

        var matches = ParameterRegex.Matches(sqlQuery);
        var optionalMatches = OptionalParameterRegex.Matches(sqlQuery);
        var parameters = new List<ReportParameter>();
        var parameterNames = new HashSet<string>();
        var optionalParameterNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (Match optionalMatch in optionalMatches)
        {
            var optionalName = optionalMatch.Groups[1].Value;
            if (!string.IsNullOrWhiteSpace(optionalName))
            {
                optionalParameterNames.Add(optionalName);
            }
        }

        foreach (Match match in matches)
        {
            var paramName = match.Groups[1].Value;
            if (!parameterNames.Contains(paramName))
            {
                parameterNames.Add(paramName);
                
                var parameter = new ReportParameter
                {
                    Name = $"@{paramName}",
                    DisplayName = GetDisplayName(paramName),
                    DataType = GetParameterType(paramName),
                    IsRequired = !optionalParameterNames.Contains(paramName)
                };

                parameters.Add(parameter);
            }
        }

        return parameters;
    }

    private static string GetDisplayName(string paramName)
    {
        // Convert parameter names to user-friendly display names
        return paramName switch
        {
            var name when name.StartsWith("p") => name[1..], // Remove 'p' prefix
            "FechaActual" => "Fecha Actual",
            "FechaCorte" => "Fecha de Corte", 
            "FechaInicial" => "Fecha Inicial",
            "FechaFinal" => "Fecha Final",
            "IdEmpresa" => "ID Empresa",
            _ => paramName
        };
    }

    private static Type GetParameterType(string paramName)
    {
        // Intelligent type detection based on parameter name patterns
        var lowerName = paramName.ToLower();
        
        if (lowerName.Contains("fecha"))
            return typeof(DateTime);

        // UniqueIdentifier parameters should be handled as Guid/string input in UI.
        if (IsGuidParameter(lowerName))
            return typeof(Guid);
        
        if (lowerName.Contains("id") || lowerName.Contains("numero"))
            return typeof(int);
        
        if (lowerName.Contains("valor") || lowerName.Contains("monto") || lowerName.Contains("precio"))
            return typeof(decimal);
        
        if (lowerName.Contains("activo") || lowerName.Contains("estado"))
            return typeof(bool);

        return typeof(string);
    }

    private static bool IsGuidParameter(string lowerName)
    {
        return lowerName.Contains("guid")
            || lowerName.Contains("uuid")
            || lowerName.Contains("uniqueidentifier")
            || lowerName.Contains("idempresa")
            || lowerName.Contains("empresaid");
    }
}
