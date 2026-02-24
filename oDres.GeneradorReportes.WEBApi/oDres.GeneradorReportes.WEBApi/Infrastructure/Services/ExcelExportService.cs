using OfficeOpenXml;
using oDres.GeneradorReportes.WEBApi.Domain.Models;

namespace oDres.GeneradorReportes.WEBApi.Infrastructure.Services;

public class ExcelExportService
{
    public byte[] ExportToExcel(ReportResult reportResult, string reportName)
    {
        ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
        
        using var package = new ExcelPackage();
        var worksheet = package.Workbook.Worksheets.Add(reportName);

        // Add headers
        for (int col = 0; col < reportResult.Columns.Count; col++)
        {
            worksheet.Cells[1, col + 1].Value = reportResult.Columns[col];
            worksheet.Cells[1, col + 1].Style.Font.Bold = true;
            worksheet.Cells[1, col + 1].Style.Fill.PatternType = OfficeOpenXml.Style.ExcelFillStyle.Solid;
            worksheet.Cells[1, col + 1].Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.LightGray);
        }

        // Add data
        for (int row = 0; row < reportResult.Data.Count; row++)
        {
            var dataRow = reportResult.Data[row];
            for (int col = 0; col < reportResult.Columns.Count; col++)
            {
                var columnName = reportResult.Columns[col];
                var value = dataRow.ContainsKey(columnName) ? dataRow[columnName] : null;
                worksheet.Cells[row + 2, col + 1].Value = value;
            }
        }

        // Auto-fit columns
        worksheet.Cells.AutoFitColumns();

        return package.GetAsByteArray();
    }
}
