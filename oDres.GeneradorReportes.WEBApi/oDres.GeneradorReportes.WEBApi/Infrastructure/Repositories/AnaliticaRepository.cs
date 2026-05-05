using Microsoft.Extensions.Configuration;
using oDres.GeneradorReportes.WEBApi.Application.DTOs;
using oDres.GeneradorReportes.WEBApi.Domain.Interfaces;
using System.Data;
using System.Data.SqlClient;
using System.Text.Json;

namespace oDres.GeneradorReportes.WEBApi.Infrastructure.Repositories;

public class AnaliticaRepository : IAnaliticaRepository
{
    private readonly string _connectionString;

    public AnaliticaRepository(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new ArgumentNullException(nameof(configuration));
    }

    // ─────────────────────────────────────────────────────────────────
    // CONTEXTO COMPLETO - carga todos los datos de una sola llamada
    // ─────────────────────────────────────────────────────────────────
    public async Task<ContextoDatosDto> CargarContextoAsync(CargarContextoRequest request)
    {
        var resultado = new ContextoDatosDto();

        var idEmpresa = request.IdEmpresa ?? string.Empty;
        var anio1Efectivo = request.Anio1 ?? DateTime.UtcNow.Year;
        var mesInicialEfectivo = request.MesInicial ?? 1;
        var anio2Efectivo = request.Anio2 ?? anio1Efectivo;
        var mesFinalEfect = request.MesFinal ?? mesInicialEfectivo;
        var acumuladoEfectivo = string.IsNullOrWhiteSpace(request.Acumulado)
            ? "A"
            : request.Acumulado.Trim().ToUpperInvariant();

        mesInicialEfectivo = Math.Clamp(mesInicialEfectivo, 1, 12);
        mesFinalEfect = Math.Clamp(mesFinalEfect, 1, 12);

        // ── Cuentas individuales (SALDOCADENA, NOMBRECTA, etc.) ──
        if (request.Cuentas.Any())
        {
            var tareas = request.Cuentas.Select(async cuenta =>
            {
                var nombre = await NombreCuentaAsync(cuenta, idEmpresa);
                var saldoInicial = await SaldoCuentaAsync(cuenta, mesInicialEfectivo, acumuladoEfectivo, idEmpresa, anio2Efectivo);
                var saldoFinal = await SaldoCuentaAsync(cuenta, mesFinalEfect, acumuladoEfectivo, idEmpresa, anio1Efectivo);
                var debito = await SaldoDBCRAsync(cuenta, mesFinalEfect, "DB", idEmpresa, anio1Efectivo);
                var credito = await SaldoDBCRAsync(cuenta, mesFinalEfect, "CR", idEmpresa, anio1Efectivo);

                return new { cuenta, nombre, saldoInicial, saldoFinal, debito, credito };
            });

            var resultados = await Task.WhenAll(tareas);

            foreach (var r in resultados)
            {
                resultado.NombresCuentas[r.cuenta] = r.nombre;
                resultado.SaldosIniciales[r.cuenta] = r.saldoInicial;
                resultado.SaldosFinales[r.cuenta] = r.saldoFinal;
                resultado.Debitos[r.cuenta] = r.debito;
                resultado.Creditos[r.cuenta] = r.credito;
            }
        }

        // ── Saldos mensuales: todos los meses (1-12) para SALDOCUENTACONTABLE(cuenta, periodo) ──
        var tareasMensuales = request.Cuentas.SelectMany(cuenta =>
            Enumerable.Range(1, 12).Select(async mes =>
            {
                var saldo = await SaldoCuentaAsync(cuenta, mes, "M", idEmpresa, anio1Efectivo);
                return new { cuenta, mes, saldo };
            }));

        var resultadosMensuales = await Task.WhenAll(tareasMensuales);
        foreach (var r in resultadosMensuales)
        {
            resultado.SaldosMensuales[$"{r.cuenta}:{r.mes}"] = r.saldo;
        }

        // ── Cadenas / rangos (SALDOCUENTACONTABLE: soporta "1-3", "11,13-15") ──
        var cadenas = request.Cadenas
            .Select(c => c.Trim())
            .Where(c => !string.IsNullOrEmpty(c))
            .Distinct()
            .ToList();

        if (cadenas.Any())
        {
            var tareasCadena = cadenas.Select(async cadena =>
            {
                var saldoFinal = await SaldoCuentaContableAsync(cadena, mesFinalEfect, acumuladoEfectivo, idEmpresa, anio1Efectivo);
                var saldoInicial = await SaldoCuentaContableAsync(cadena, mesInicialEfectivo, acumuladoEfectivo, idEmpresa, anio2Efectivo);
                return new { cadena, saldoFinal, saldoInicial };
            });

            var resultadosCadena = await Task.WhenAll(tareasCadena);

            foreach (var r in resultadosCadena)
            {
                resultado.SaldosCadenaFinal[r.cadena] = r.saldoFinal;
                resultado.SaldosCadenaInicial[r.cadena] = r.saldoInicial;
            }
        }

        return resultado;
    }

    // ─────────────────────────────────────────────────────────────────
    // NOMBRECTA - retorna el nombre de la cuenta contable
    // 
    // ─────────────────────────────────────────────────────────────────
    public async Task<string> NombreCuentaAsync(string cuenta, string idEmpresa)
    {
        const string sql = @"
        SELECT TOP 1 ISNULL(NombreCuenta, NombreCuenta) AS NombreCuenta
            FROM [Empresa].[CuentaContable]
            WHERE CodigoCuenta = @cuenta
              AND (@idEmpresa IS NULL OR IdEmpresa = @idEmpresa)
            ORDER BY CodigoCuenta";

        return await ExecuteScalarAsync<string>(sql, cmd =>
        {
            cmd.Parameters.AddWithValue("@cuenta", cuenta);
            var p = cmd.Parameters.Add("@idEmpresa", System.Data.SqlDbType.UniqueIdentifier);
            p.Value = string.IsNullOrWhiteSpace(idEmpresa) ? DBNull.Value : Guid.Parse(idEmpresa);
        }) ?? cuenta;
    }

    // ─────────────────────────────────────────────────────────────────
    // SALDOCONTABLECUENTA - retorna el saldo acumulado de una cuenta
    // ─────────────────────────────────────────────────────────────────
    public async Task<decimal> SaldoCuentaAsync(string cuenta, int periodo, string acumulado, string idEmpresa, int año)
    {
        string sql;

        if (acumulado == "A")
        {
            // Saldo acumulado: suma de todos los movimientos desde el mes 1 hasta el período
            sql = @"
                    SELECT ISNULL(SUM(m.Cargo - m.Abono), 0)
                    FROM [Empresa].[MovimientoContable] m
                    INNER JOIN Registro.Empresa e ON e.IdEmpresa = m.IdEmpresa
                    INNER JOIN [Empresa].[CuentaContable] Cuenta ON Cuenta.IdCuentaContable = m.IdCuentaContable
                    WHERE Cuenta.CodigoCuenta LIKE @cuenta + '%'
                        AND (@idEmpresa IS NULL OR e.IdEmpresa = @idEmpresa)
                        AND Year(m.FechaMovimiento) = @año
                        AND Month(m.FechaMovimiento) <= @periodo";
        }
        else
        {
            // Saldo del período específico
            sql = @"
                    SELECT ISNULL(SUM(m.Cargo - m.Abono), 0)
                    FROM [Empresa].[MovimientoContable] m
                    INNER JOIN Registro.Empresa e ON e.IdEmpresa = m.IdEmpresa
                    INNER JOIN [Empresa].[CuentaContable] Cuenta ON Cuenta.IdCuentaContable = m.IdCuentaContable
                    WHERE Cuenta.CodigoCuenta LIKE @cuenta + '%'
                        AND (@idEmpresa IS NULL OR e.IdEmpresa = @idEmpresa)
                        AND Year(m.FechaMovimiento) = @año
                        AND Month(m.FechaMovimiento) = @periodo";
        }

        return await ExecuteScalarAsync<decimal>(sql, cmd =>
        {
            cmd.Parameters.AddWithValue("@cuenta", cuenta);
            var p = cmd.Parameters.Add("@idEmpresa", System.Data.SqlDbType.UniqueIdentifier);
            p.Value = string.IsNullOrWhiteSpace(idEmpresa) ? DBNull.Value : Guid.Parse(idEmpresa);
            cmd.Parameters.AddWithValue("@año", año);
            cmd.Parameters.AddWithValue("@periodo", periodo);
        });
    }

    // ─────────────────────────────────────────────────────────────────
    // SALDOCONTABLECTADBCR - retorna saldo según naturaleza DB o CR
    // ─────────────────────────────────────────────────────────────────
    public async Task<decimal> SaldoDBCRAsync(string cuenta, int periodo, string naturaleza, string idEmpresa, int año)
    {
        const string sql = @"
                            SELECT ISNULL(SUM(
                                    CASE
                                        WHEN @naturaleza = 'DB' THEN m.Cargo
                                        WHEN @naturaleza = 'CR' THEN m.Abono
                                        ELSE m.Cargo - m.Abono
                                    END
                            ), 0)
                            FROM [Empresa].[MovimientoContable] m
                            INNER JOIN Registro.Empresa e ON e.IdEmpresa = m.IdEmpresa
                            INNER JOIN [Empresa].[CuentaContable] Cuenta ON Cuenta.IdCuentaContable = m.IdCuentaContable
                            WHERE Cuenta.CodigoCuenta LIKE @cuenta + '%'
                                AND (@idEmpresa IS NULL OR e.IdEmpresa = @idEmpresa)
                                AND Year(m.FechaMovimiento) = @año
                                AND Month(m.FechaMovimiento) <= @periodo";

        return await ExecuteScalarAsync<decimal>(sql, cmd =>
        {
            cmd.Parameters.AddWithValue("@cuenta", cuenta);
            var p = cmd.Parameters.Add("@idEmpresa", System.Data.SqlDbType.UniqueIdentifier);
            p.Value = string.IsNullOrWhiteSpace(idEmpresa) ? DBNull.Value : Guid.Parse(idEmpresa);
            cmd.Parameters.AddWithValue("@año", año);
            cmd.Parameters.AddWithValue("@periodo", periodo);
            cmd.Parameters.AddWithValue("@naturaleza", naturaleza);
        });
    }

    // ─────────────────────────────────────────────────────────────────
    // SALDOCONTABLECUENTACADENA - totales de múltiples cuentas
    // ─────────────────────────────────────────────────────────────────
    public async Task<decimal> SaldoCuentaCadenaAsync(string cuentas, int periodo, string acumulado, string idEmpresa, int año)
    {
        var listaCuentas = cuentas.Split(',').Select(c => c.Trim()).ToList();
        var total = 0m;

        foreach (var cuenta in listaCuentas)
        {
            total += await SaldoCuentaAsync(cuenta, periodo, acumulado, idEmpresa, año);
        }

        return total;
    }

    // ─────────────────────────────────────────────────────────────────
    // GESTIÓN DE PLANTILLAS - guardar/recuperar diseños de spreadsheet
    // ─────────────────────────────────────────────────────────────────
    public async Task<List<PlantillaAnaliticaDto>> GetPlantillasAsync()
    {
        const string sql = @"
            SELECT IdPlantilla, Nombre, Descripcion, Contenido, FechaActualizacion
            FROM Catalogo.PlantillaAnalitica
            WHERE Activo = 1
            ORDER BY Nombre";

        var lista = new List<PlantillaAnaliticaDto>();

        using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();
        using var cmd = new SqlCommand(sql, connection);
        using var reader = await cmd.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            lista.Add(new PlantillaAnaliticaDto
            {
                Id = reader["IdPlantilla"].ToString()!,
                Nombre = reader["Nombre"]?.ToString() ?? "",
                Descripcion = reader["Descripcion"]?.ToString() ?? "",
                Contenido = reader["Contenido"]?.ToString() ?? "{}",
                FechaActualizacion = reader.GetDateTime(reader.GetOrdinal("FechaActualizacion"))
            });
        }

        return lista;
    }

    public async Task<PlantillaAnaliticaDto?> GetPlantillaByIdAsync(string id)
    {
        const string sql = @"
            SELECT IdPlantilla, Nombre, Descripcion, Contenido, FechaActualizacion
            FROM Catalogo.PlantillaAnalitica
            WHERE IdPlantilla = @id AND Activo = 1";

        using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();
        using var cmd = new SqlCommand(sql, connection);
        cmd.Parameters.AddWithValue("@id", id);
        using var reader = await cmd.ExecuteReaderAsync();

        if (await reader.ReadAsync())
        {
            return new PlantillaAnaliticaDto
            {
                Id = reader["IdPlantilla"].ToString()!,
                Nombre = reader["Nombre"]?.ToString() ?? "",
                Descripcion = reader["Descripcion"]?.ToString() ?? "",
                Contenido = reader["Contenido"]?.ToString() ?? "{}",
                FechaActualizacion = reader.GetDateTime(reader.GetOrdinal("FechaActualizacion"))
            };
        }

        return null;
    }

    public async Task<PlantillaAnaliticaDto> GuardarPlantillaAsync(GuardarPlantillaRequest request)
    {
        var id = string.IsNullOrEmpty(request.Id) ? Guid.NewGuid().ToString() : request.Id;
        var ahora = DateTime.UtcNow;

        const string sql = @"
            MERGE Catalogo.PlantillaAnalitica AS target
            USING (SELECT @id AS IdPlantilla) AS source ON target.IdPlantilla = source.IdPlantilla
            WHEN MATCHED THEN
                UPDATE SET Nombre = @nombre, Descripcion = @descripcion, Contenido = @contenido, FechaActualizacion = @fecha
            WHEN NOT MATCHED THEN
                INSERT (IdPlantilla, Nombre, Descripcion, Contenido, Activo, FechaRegistro, FechaActualizacion)
                VALUES (@id, @nombre, @descripcion, @contenido, 1, @fecha, @fecha);";

        using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();
        using var cmd = new SqlCommand(sql, connection);
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@nombre", request.Nombre);
        cmd.Parameters.AddWithValue("@descripcion", request.Descripcion ?? "");
        cmd.Parameters.AddWithValue("@contenido", request.Contenido);
        cmd.Parameters.AddWithValue("@fecha", ahora);
        await cmd.ExecuteNonQueryAsync();

        return new PlantillaAnaliticaDto
        {
            Id = id,
            Nombre = request.Nombre,
            Descripcion = request.Descripcion ?? "",
            Contenido = request.Contenido,
            FechaActualizacion = ahora
        };
    }

    public async Task DeletePlantillaAsync(string id)
    {
        const string sql = "UPDATE Catalogo.PlantillaAnalitica SET Activo = 0 WHERE IdPlantilla = @id";

        using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();
        using var cmd = new SqlCommand(sql, connection);
        cmd.Parameters.AddWithValue("@id", id);
        await cmd.ExecuteNonQueryAsync();
    }

    // ─────────────────────────────────────────────────────────────────
    // SALDOCUENTACONTABLE - VBS 1.SaldoCuentaContable.VBS
    // Soporta múltiples cuentas separadas por coma y rangos con guión.
    // Ej: "11,13-15,22" → LIKE '11%' OR (BETWEEN '13' AND '15' OR LIKE '15%') OR LIKE '22%'
    // Acumulado "A": (Año=@año AND Mes<=@periodo) OR (Año < @año)
    // Mensual  "M": Año=@año AND Mes=@periodo
    // Periodo válido: 1–13
    // ─────────────────────────────────────────────────────────────────
    public async Task<decimal> SaldoCuentaContableAsync(
        string cuentas, int periodo, string acumulado, string idEmpresa, int año)
    {
        // ── Validaciones ──
        if (string.IsNullOrWhiteSpace(cuentas)) return 0m;
        acumulado = (acumulado ?? "").Trim().ToUpperInvariant();
        if (acumulado != "A" && acumulado != "M") return 0m;
        if (periodo < 1 || periodo > 13) return 0m;
        if (año == 0) return 0m;

        // Parsear segmentos de cuentas
        var (cuentaFilter, cuentaParams) = ParseCuentasFilter(cuentas);
        if (string.IsNullOrEmpty(cuentaFilter)) return 0m;

        // Filtro de período según VBS
        string periodoFilter = acumulado == "A"
            ? @"((YEAR(m.FechaMovimiento) = @año AND MONTH(m.FechaMovimiento) <= @periodo)
                OR YEAR(m.FechaMovimiento) < @año)"
            : "YEAR(m.FechaMovimiento) = @año AND MONTH(m.FechaMovimiento) = @periodo";

        var sql = $@"
            SELECT ISNULL(SUM(m.Cargo - m.Abono), 0)
            FROM [Empresa].[MovimientoContable] m
            INNER JOIN [Empresa].[CuentaContable] c ON c.IdCuentaContable = m.IdCuentaContable
            WHERE ({cuentaFilter})
              AND (@idEmpresa IS NULL OR m.IdEmpresa = @idEmpresa)
              AND {periodoFilter}";

        return await ExecuteScalarAsync<decimal>(sql, cmd =>
        {
            foreach (var p in cuentaParams)
                cmd.Parameters.AddWithValue(p.Key, p.Value);
            AddIdEmpresaParam(cmd, idEmpresa);
            cmd.Parameters.AddWithValue("@año", año);
            cmd.Parameters.AddWithValue("@periodo", periodo);
        });
    }

    // ─────────────────────────────────────────────────────────────────
    // SALDOCUENTACONTABLEDBCR - VBS 2.SaldoCuentaContableDBCR.vbs
    // Retorna Sum(Débito) o Sum(Crédito) de una cuenta para un año/periodo.
    // Siempre mensual (Periodo = @periodo), no acumulado.
    // pTipo: "DB" → Sum(Cargo), "CR" → Sum(Abono)
    // Periodo válido: 1–12
    // ─────────────────────────────────────────────────────────────────
    public async Task<decimal> SaldoCuentaContableDBCRAsync(
        string cuenta, int periodo, string tipo, string idEmpresa, int año)
    {
        // ── Validaciones ──
        if (string.IsNullOrWhiteSpace(cuenta)) return 0m;
        tipo = (tipo ?? "").Trim().ToUpperInvariant();
        if (tipo != "DB" && tipo != "CR") return 0m;
        if (periodo < 1 || periodo > 12) return 0m;
        if (año == 0) return 0m;

        // VBS: Sum(Debito) o Sum(Credito) directamente, siempre mensual
        var columna = tipo == "DB" ? "m.Cargo" : "m.Abono";

        var sql = $@"
            SELECT ISNULL(SUM({columna}), 0)
            FROM [Empresa].[MovimientoContable] m
            INNER JOIN [Empresa].[CuentaContable] c ON c.IdCuentaContable = m.IdCuentaContable
            WHERE c.CodigoCuenta LIKE @cuenta + '%'
              AND (@idEmpresa IS NULL OR m.IdEmpresa = @idEmpresa)
              AND YEAR(m.FechaMovimiento) = @año
              AND MONTH(m.FechaMovimiento) = @periodo";

        return await ExecuteScalarAsync<decimal>(sql, cmd =>
        {
            cmd.Parameters.AddWithValue("@cuenta", cuenta.Trim());
            AddIdEmpresaParam(cmd, idEmpresa);
            cmd.Parameters.AddWithValue("@año", año);
            cmd.Parameters.AddWithValue("@periodo", periodo);
        });
    }

    // ─────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────
    private async Task<T> ExecuteScalarAsync<T>(string sql, Action<SqlCommand> parametros)
    {
        using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();
        using var cmd = new SqlCommand(sql, connection);
        parametros(cmd);
        var result = await cmd.ExecuteScalarAsync();
        if (result == null || result == DBNull.Value)
            return default!;
        return (T)Convert.ChangeType(result, typeof(T));
    }

    /// <summary>
    /// Agrega el parámetro @idEmpresa como UniqueIdentifier.
    /// Si está vacío se envía DBNull (filtro opcional en el WHERE).
    /// </summary>
    private static void AddIdEmpresaParam(SqlCommand cmd, string idEmpresa)
    {
        var p = cmd.Parameters.Add("@idEmpresa", SqlDbType.UniqueIdentifier);
        p.Value = string.IsNullOrWhiteSpace(idEmpresa)
            ? DBNull.Value
            : Guid.Parse(idEmpresa);
    }

    /// <summary>
    /// Parsea el parámetro de cuentas con soporte para comas y rangos.
    /// Formato: "11,13-15,22"
    ///   - "11"    → c.CodigoCuenta LIKE @c0 + '%'
    ///   - "13-15" → (c.CodigoCuenta BETWEEN @rs1 AND @re1 OR c.CodigoCuenta LIKE @re1 + '%')
    ///   - "22"    → c.CodigoCuenta LIKE @c2 + '%'
    /// Retorna la cláusula WHERE parcial y sus parámetros.
    /// </summary>
    private static (string whereClause, Dictionary<string, string> parameters) ParseCuentasFilter(string cuentas)
    {
        var segments = cuentas.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var conditions = new List<string>();
        var parameters = new Dictionary<string, string>();

        for (int i = 0; i < segments.Length; i++)
        {
            var seg = segments[i];
            var dashIdx = seg.IndexOf('-');

            if (dashIdx > 0 && dashIdx < seg.Length - 1)
            {
                // Rango: "13-15" → BETWEEN + LIKE (VBS incluye subcuentas del extremo final)
                var rangoInicio = seg[..dashIdx].Trim();
                var rangoFin = seg[(dashIdx + 1)..].Trim();
                conditions.Add($"(c.CodigoCuenta BETWEEN @rs{i} AND @re{i} OR c.CodigoCuenta LIKE @re{i} + '%')");
                parameters[$"@rs{i}"] = rangoInicio;
                parameters[$"@re{i}"] = rangoFin;
            }
            else
            {
                // Cuenta individual: "11" → LIKE '11%'
                conditions.Add($"c.CodigoCuenta LIKE @c{i} + '%'");
                parameters[$"@c{i}"] = seg.Trim();
            }
        }

        return (string.Join(" OR ", conditions), parameters);
    }
}