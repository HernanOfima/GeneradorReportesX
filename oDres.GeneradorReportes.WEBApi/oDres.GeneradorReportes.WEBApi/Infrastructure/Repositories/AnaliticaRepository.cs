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

        if (!request.Cuentas.Any())
            return resultado;

        var tareas = request.Cuentas.Select(async cuenta =>
        {
            var nombre = await NombreCuentaAsync(cuenta, request.Empresa);
            var saldoInicial = await SaldoCuentaAsync(cuenta, request.MesInicial, request.Acumulado, request.Empresa, request.Anio2);
            var saldoFinal = await SaldoCuentaAsync(cuenta, request.MesFinal, request.Acumulado, request.Empresa, request.Anio1);
            var debito = await SaldoDBCRAsync(cuenta, request.MesFinal, "DB", request.Empresa, request.Anio1);
            var credito = await SaldoDBCRAsync(cuenta, request.MesFinal, "CR", request.Empresa, request.Anio1);

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

        return resultado;
    }

    // ─────────────────────────────────────────────────────────────────
    // NOMBRECTA - retorna el nombre de la cuenta contable
    // Equivalente a: ofima.xla!NOMBRECTA(cuenta, empresa)
    // ─────────────────────────────────────────────────────────────────
    public async Task<string> NombreCuentaAsync(string cuenta, string empresa)
    {
        const string sql = @"
        SELECT TOP 1 ISNULL(NombreCuenta, NombreCuenta) AS NombreCuenta
            FROM [Empresa].[CuentaContable]
            WHERE CodigoCuenta = @cuenta
              --AND IdEmpresa = (SELECT IdEmpresa FROM Empresa.Empresa WHERE Codigo = @empresa)
            ORDER BY CodigoCuenta";

        return await ExecuteScalarAsync<string>(sql, cmd =>
        {
            cmd.Parameters.AddWithValue("@cuenta", cuenta);
            cmd.Parameters.AddWithValue("@empresa", empresa);
        }) ?? cuenta;
    }

    // ─────────────────────────────────────────────────────────────────
    // SALDOCONTABLECUENTA - retorna el saldo acumulado de una cuenta
    // Equivalente a: ofima.xla!SALDOCONTABLECUENTA(cuenta, periodo, acumulado, empresa, año)
    // ─────────────────────────────────────────────────────────────────
    public async Task<decimal> SaldoCuentaAsync(string cuenta, int periodo, string acumulado, string empresa, int año)
    {
        string sql;

        if (acumulado == "A")
        {
            // Saldo acumulado: suma de todos los movimientos desde el mes 1 hasta el período
            sql = @"
                    SELECT ISNULL(SUM(
                        
                            m.Cargo - Abono
                    
                    ), 0)
                    FROM [Empresa].[MovimientoContable] m
                    INNER JOIN Registro.Empresa e ON e.IdEmpresa = m.IdEmpresa
                    Inner Join [Empresa].[CuentaContable] Cuenta On Cuenta.IdCuentaContable = m.IdCuentaContable
                    WHERE Cuenta.CodigoCuenta LIKE @cuenta + '%'
                        --AND e.Codigo = @empresa
                        AND Year(m.FechaMovimiento) = @año
                        AND Month(m.FechaMovimiento) <= @periodo";
        }
        else
        {
            // Saldo del período específico
            sql = @"
                    SELECT ISNULL(SUM(
                        
                            m.Cargo - Abono
                    
                    ), 0)
                    FROM [Empresa].[MovimientoContable] m
                    INNER JOIN Registro.Empresa e ON e.IdEmpresa = m.IdEmpresa
                    Inner Join [Empresa].[CuentaContable] Cuenta On Cuenta.IdCuentaContable = m.IdCuentaContable
                    WHERE Cuenta.CodigoCuenta LIKE @cuenta + '%'
                        --AND e.Codigo = @empresa
                        AND Year(m.FechaMovimiento) = @año
                        AND Month(m.FechaMovimiento) = @periodo";
        }

        return await ExecuteScalarAsync<decimal>(sql, cmd =>
        {
            cmd.Parameters.AddWithValue("@cuenta", cuenta);
            cmd.Parameters.AddWithValue("@empresa", empresa);
            cmd.Parameters.AddWithValue("@año", año);
            cmd.Parameters.AddWithValue("@periodo", periodo);
        });
    }

    // ─────────────────────────────────────────────────────────────────
    // SALDOCONTABLECTADBCR - retorna saldo según naturaleza DB o CR
    // Equivalente a: ofima.xla!SaldoContableCtaDBCR(cuenta, periodo, naturaleza, empresa, año)
    // ─────────────────────────────────────────────────────────────────
    public async Task<decimal> SaldoDBCRAsync(string cuenta, int periodo, string naturaleza, string empresa, int año)
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
                            Inner Join [Empresa].[CuentaContable] Cuenta On Cuenta.IdCuentaContable = m.IdCuentaContable
                            WHERE Cuenta.CodigoCuenta LIKE @cuenta + '%'
                                --AND e.Codigo = @empresa
                                AND Year(m.FechaMovimiento) = @año
                                AND Month(m.FechaMovimiento) <= @periodo";

        return await ExecuteScalarAsync<decimal>(sql, cmd =>
        {
            cmd.Parameters.AddWithValue("@cuenta", cuenta);
            cmd.Parameters.AddWithValue("@empresa", empresa);
            cmd.Parameters.AddWithValue("@año", año);
            cmd.Parameters.AddWithValue("@periodo", periodo);
            cmd.Parameters.AddWithValue("@naturaleza", naturaleza);
        });
    }

    // ─────────────────────────────────────────────────────────────────
    // SALDOCONTABLECUENTACADENA - totales de múltiples cuentas
    // Equivalente a: ofima.xla!SaldoContableCuentaCadena("1,2,3", ...)
    // ─────────────────────────────────────────────────────────────────
    public async Task<decimal> SaldoCuentaCadenaAsync(string cuentas, int periodo, string acumulado, string empresa, int año)
    {
        var listaCuentas = cuentas.Split(',').Select(c => c.Trim()).ToList();
        var total = 0m;

        foreach (var cuenta in listaCuentas)
        {
            total += await SaldoCuentaAsync(cuenta, periodo, acumulado, empresa, año);
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
    // HELPER
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
}
