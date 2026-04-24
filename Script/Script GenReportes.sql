Key HernanOfima


Select  NumeroDocumento,TipoTransaccion,Fecha,Identificador,
		NombreProveedor,SubTotal,Descuento, ValorIVA,RetencionIVA,
		TotalDocumento, NombreEmpresa,idempresa
	From [dbo].[vReporte_DetalladoCompras] 
	Where IdEmpresa = 'B62C2D64-D4FB-4010-976A-05166C324413' And
		Fecha BetWeen '20210101' And '20261201'


Select  NumeroDocumento,TipoTransaccion,Fecha,Identificador,
		NombreProveedor,SubTotal,Descuento, ValorIVA,RetencionIVA,
		TotalDocumento, NombreEmpresa
	From [dbo].[vReporte_DetalladoCompras] 
	Where IdEmpresa = @pIdEmpresa And
		Fecha BetWeen @pFechaInicial And  @pFechaFinal

Select CodigoProducto,Descripcion 
	FRom [dbo].[vReporte_ListadoProductosTieneCompras]
	Where IdEmpresa = @pIdEmpresa And 
		  IdProducto = @pIdProducto


Select CodigoSAT,NoIdentificacion,Descripcion, ClaveUnidad, Cantidad,ValorUnitario, Descuento, SubTotalItem
	From [dbo].[vReporte_DetalladoMovimientoComercial]
	Where ClaveUnidad = @pUnidadMedida

Select * 
	From Empresa.FN_ExtractoCobranzaPorDias(@FechaActual,@pFechaCorte)  
	Where IdEmpresa = @pIdEmpresa

{
  "reportId": "0896600F-62AB-4322-8517-16E400AC480C",
  "parameters": {
    "@pIdEmpresa": "B62C2D64-D4FB-4010-976A-05166C324413",
    "@pFechaInicial": "20200101",
    "@pFechaFinal": "20260101"
  }
}

------------------------------------------------------------------
Declare	@FechaActual DATETIME = '20260101'
Declare @FechaCorte  DATETIME = '20260101'

Select * 
	From Empresa.FN_ExtractoCobranzaPorDias(@FechaActual,@FechaCorte)  
			Where IdEmpresa = '0FF67BF9-54D7-4E76-83AD-E1D5A69FE951'
------------------------------------------------------------------


Select	NumeroDocumento,TipoTransaccion As TipoDcto,Nombre As TipoTransaccion, Identificador,NombreCliente,
		SubTotal,Descuento,ValorIVA,RetencionIVA,TotalDocumento 
	From dbo.vReporte_DetalladoFacturas
		Where Fecha BetWeen @pFechaInicial And  @pFechaFinal

SELECT     Empresa.Nombre As NombreEmpresa,    Empleado.CodigoEmpleado,    Grupo.NombreGrupo,    Candidato.Nombres,    Candidato.TelefonoCelular,    Candidato.CuentaBanco,    Candidato.Dir_Ciudad,    Area.Valor,    Empleado.SDI,    Empleado.CuotaDiaria    FROM Empresa_Nom.Empleados Empleado       Inner Join Empresa_Nom.V_grupos Grupo On Empleado.IdGrupoNomina = Grupo.IdGrupo      Inner Join Empresa_RH.Candidatos Candidato On Empleado.IdCandidato = Candidato.IdCandidato        Inner Join Catalogo_Nom.AreaGeografica Area On Area.IdAreaGeografica = Grupo.IdAreaGeografica      Inner Join Registro.Empresa  On Candidato.IdEmpresa = Empresa.IdEmpresa    Order By Empresa.Nombre
Select * FRom [Empresa].[vReporte_ListadoProyectosCompra]

Select * from catalogo.modulo

---------------------------------------------------------------------------------------
--Listar los reportes
Select IdReporte, Modulo.Nombre As Modulo,Reporte.Nombre , Titulo, Reporte.IdModulo, 
	   SentenciaSQL,TipoReporte 
	FRom Catalogo.Reportes Reporte
		Inner Join Catalogo.Modulo Modulo On Reporte.IdModulo = Modulo.IdModulo
	Order By Modulo.Nombre
---------------------------------------------------------------------------------------

Select *    From Empresa.FN_ExtractoCobranzaPorDias(@FechaActual,@pFechaCorte)     Where IdEmpresa = @pIdEmpresa

Select TipoTransaccion As TipoDcto,Nombre As TipoTransaccion, Identificador,NombreCliente,    SubTotal,Descuento,ValorIVA,RetencionIVA,TotalDocumento    From dbo.vReporte_DetalladoFacturas Facturas    Where Fecha BetWeen @pFechaInicial And  @pFechaFinal

SELECT 
		Empresa.Nombre As NombreEmpresa,
		Empleado.CodigoEmpleado,
		Grupo.NombreGrupo,
		Candidato.Nombres,
		Candidato.TelefonoCelular,
		Candidato.CuentaBanco,
		Candidato.Dir_Ciudad,
		Area.Valor,
		Empleado.SDI,
		Empleado.CuotaDiaria
		FROM Empresa_Nom.Empleados Empleado 
				Inner Join Empresa_Nom.V_grupos Grupo On Empleado.IdGrupoNomina = Grupo.IdGrupo
				Inner Join Empresa_RH.Candidatos Candidato On Empleado.IdCandidato = Candidato.IdCandidato		
				Inner Join Catalogo_Nom.AreaGeografica Area On Area.IdAreaGeografica = Grupo.IdAreaGeografica
				Inner Join Registro.Empresa  On Candidato.IdEmpresa = Empresa.IdEmpresa
		Order By Empresa.Nombre

Execute Empresa.spReporte_DetalleSaldoInventarioProducto 'B62C2D64-D4FB-4010-976A-05166C324413',2024,12,Null

Empresa.SP_BalanceCuentaContable @IdEmpresa ,@Ano, @Periodo, @pNivel=6,@IncluirCuentasSinMovimiento=1,@SoloTotales=0

{
  "reportId": "A616B9B3-D991-46A4-A634-EEBA10F885D2",
  "parameters": {
    "@IdEmpresa": "B62C2D64-D4FB-4010-976A-05166C324413",
    "@Ano": "2026",
	"@Periodo": "1",
    "@pNivel": "6",
	"@IncluirCuentasSinMovimiento": "0",
	"@SoloTotales": "0"
  }
}

select * from [Registro].[Empresa]

EXEC [Empresa].[SP_BalanceCuentaContable] 
	@IdEmpresa = '41FCD3E6-4ED6-4EFE-853F-FB26D40F1AAF',
	@Ano = 2026, 
	@Periodo = 2, 
	@pNivel = 6, 
	@IncluirCuentasSinMovimiento = 1, 
	@SoloTotales= 0


Select	NumeroDocumento,TipoTransaccion As TipoDcto,Nombre As TipoTransaccion, Identificador,NombreCliente,
		SubTotal,Descuento,ValorIVA,RetencionIVA,TotalDocumento 
	From dbo.vReporte_DetalladoFacturas
		Where Fecha Between '20210101' And '20261230'

-- Empresa.spReporte_ResumenSaldoInventario @pIdEmpresa, @pYY, @pMM, @pIdProducto=Null, @pIdBodega=Null, @pIdLote=Null
Execute Empresa.spReporte_ResumenSaldoInventario
		@pIdEmpresa	= 'B62C2D64-D4FB-4010-976A-05166C324413'	, 
		@pYY		= 2024	, 
		@pMM		= 12	, 
		@pIdProducto= Null	,	 
		@pIdBodega	= Null	, 
		@pIdLote	= Null
	
-- Sales by vendor with client details
Select NombreVendedor,Identificador, NombreCliente,NumeroDocumento,TipoTransaccion As TipoDcto,Nombre As TipoTransaccion,
		SubTotal,Descuento,ValorIVA,RetencionIVA,TotalDocumento
	From dbo.vReporte_DetalladoFacturas
	Where Fecha BetWeen @pFechaInicial And  @pFechaFinal
	Order By NombreVendedor,Identificador, NombreCliente

-- Sales by vendor summary
Select	NombreVendedor,NumeroDocumento,TipoTransaccion As TipoDcto,Nombre As TipoTransaccion, 
		SubTotal,Descuento,ValorIVA,RetencionIVA,TotalDocumento 
	From dbo.vReporte_DetalladoFacturas
	Where Fecha BetWeen @pFechaInicial And  @pFechaFinal
	Order By NombreVendedor

-- Collection related queries
Execute Timbrado_FEObtenerCobranzaTimbrar
Select * From [Empresa].[vReporte_DetalladoCobranzaCliente]

-- Collection extract by days
Select Cliente,NombreCliente,Serie, Folio, deuda, pagado, Saldo
	From Empresa.FN_ExtractoCobranzaPorDias(@pFechaActualReporte,@pFechaCorteReporte)
	Where IdEmpresa = @pIdEmpresa

-- Sales by client
Select 
		 Identificador 
		,NombreCliente
		,Fecha
		,Nombre
		,CodigoOrigen
		,NumeroDocumento
		,ClaveTipoTransaccion
		,SubTotal
		,Descuento
		,TotalDocumento
	From vReporte_ListadoFacturas
	Where --IdEmpresa = @pIdEmpresa And
		Fecha BetWeen @pFechaInicial And  @pFechaFinal
	Order By Identificador

-- Product movement details
Select 
		 NoIdentificacion
		,Descripcion
		,NumeroDocumento
		,TipoTransaccion
		,FechaDocumento
		,ClaveUnidad
		,UnidadMedida
		,Cantidad
		,ValorUnitario
		,Descuento
		,SubTotalItem
	From vReporte_DetalladoMovimientoProducto
		Where FechaDocumento BetWeen @pFechaInicial And  @pFechaFinal
	Order By NoIdentificacion

	select * from vReporte_DetalladoFacturas

Select TipoTransaccion As TipoDcto,Nombre As TipoTransaccion, Identificador,NombreCliente,    SubTotal,Descuento,ValorIVA,RetencionIVA,TotalDocumento    
From dbo.vReporte_DetalladoFacturas Facturas    
Where Fecha BetWeen @pFechaInicial And  @pFechaFinal

Select  NumeroDocumento,TipoTransaccion,Fecha,Identificador,    NombreProveedor,SubTotal,Descuento, ValorIVA,RetencionIVA,    TotalDocumento, NombreEmpresa   From [dbo].[vReporte_DetalladoCompras]    Where IdEmpresa = @pIdEmpresa And    Fecha BetWeen @pFechaInicial And  @pFechaFinal

Select      NoIdentificacion    ,Descripcion    ,NumeroDocumento    ,TipoTransaccion    ,FechaDocumento    ,ClaveUnidad    ,UnidadMedida    ,Cantidad    ,ValorUnitario    ,Descuento    ,SubTotalItem   From vReporte_DetalladoMovimientoProducto    Where IdEmpresa = @pIdEmpresa And FechaDocumento BetWeen @pFechaInicial And  @pFechaFinal   Order By NoIdentificacion

Select * from vReporte_DetalladoMovimientoProducto
Select      NoIdentificacion    ,Descripcion    ,NumeroDocumento    ,TipoTransaccion    ,FechaDocumento    ,ClaveUnidad    ,UnidadMedida    ,Cantidad    ,ValorUnitario    ,Descuento    ,SubTotalItem   From vReporte_DetalladoMovimientoProducto    Where IdEmpresa = @pIdEmpresa And FechaDocumento BetWeen @pFechaInicial And  @pFechaFinal   Order By NoIdentificacion




Select      NoIdentificacion    ,Descripcion    ,NumeroDocumento    ,TipoTransaccion    ,FechaDocumento    ,ClaveUnidad    ,UnidadMedida    ,Cantidad    ,ValorUnitario    ,Descuento    ,SubTotalItem   
From vReporte_DetalladoMovimientoProducto   
Where IdEmpresa = @pIdEmpresa And FechaDocumento BetWeen @pFechaInicial And  @pFechaFinal   Order By NoIdentificacion



-- Report listings with different variations
Select IdReporte, Modulo.Nombre As Modulo,Reporte.Nombre , Titulo, Reporte.IdModulo, 
	   SentenciaSQL,TipoReporte , OrdenMostrar, AgrupaPor
	FRom Catalogo.Reportes Reporte
		Inner Join Catalogo.Modulo Modulo On Reporte.IdModulo = Modulo.IdModulo
	Order By Modulo.Nombre, OrdenMostrar

Select Modulo.Nombre As Modulo,Reporte.Nombre , Titulo, AgrupaPor
	FRom Catalogo.Reportes Reporte
		Inner Join Catalogo.Modulo Modulo On Reporte.IdModulo = Modulo.IdModulo
	Order By Modulo.Nombre, OrdenMostrar

Select IdReporte,Reporte.Nombre , Titulo, Reporte.IdModulo, 
	   SentenciaSQL,TipoReporte 
	FRom Catalogo.Reportes Reporte
	Order By Reporte.IdModulo

SELECT IdReporte, Nombre, Titulo, IdModulo, OrdenMostrar
FROM     Catalogo.Reportes
ORDER BY IdModulo, OrdenMostrar

---------------------------------------------------------------------------------------
--Listar los reportes
Select IdReporte, Modulo.Nombre As Modulo,Reporte.Nombre , Titulo, Reporte.IdModulo, 
	   SentenciaSQL,TipoReporte 
	FRom Catalogo.Reportes Reporte
		Inner Join Catalogo.Modulo Modulo On Reporte.IdModulo = Modulo.IdModulo
	Order By Modulo.Nombre, OrdenMostrar
---------------------------------------------------------------------------------------

Select * from Catalogo.reportes
Empresa.SP_BalanceCuentaContable @IdEmpresa ,@Ano, @Periodo, @pNivel=6,@IncluirCuentasSinMovimiento=1,@SoloTotales=0
ALTER TABLE Catalogo.Reportes ADD
	MuestraTotales bit NOT NULL CONSTRAINT DF_Reportes_MuestraTotales DEFAULT 1

--Menu de Generador Reportes
--	Reportes
--		Generador Reporte reportes/generador-reportes
--	Contabilidad
--		reportes/generador-reportes?idModulo=BD7F18B3-34A2-4585-B007-13D135D223B6
--	Inventario
--		reportes/generador-reportes?idModulo=A06BEECE-7F64-4BB5-873C-AF9ED6F9B273
--	Ventas - Ingresos
--		reportes/generador-reportes?idModulo=D7C2A630-A2AE-40D3-BCC9-EF9ED2E1191A
--  Cuentas por Cobrar
--		reportes/generador-reportes?idModulo=B449B6A9-7C27-48F1-93D2-512BF63C5179
--	Compras - Egresos
--		reportes/generador-reportes?idModulo=6374EC1E-0573-4F6A-B6BF-B7006A4B1389
--	Cuentas por Pagar
--		reportes/generador-reportes?idModulo=100D072B-08FA-4913-B2E7-2DCDE7D12D2F
--	Bancos
--		reportes/generador-reportes?idModulo=A1F58ABA-ECA5-4E5F-B829-705A77959103
--	RH-Nomina
--		reportes/generador-reportes?idModulo=9632C87F-55A5-4F60-A627-FCAE9891D497



select * from Catalogo.TipoLicencia

Execute Catalogo.ModuloXMenuXLicencia_SELECT
	@Activo = 1,
	@esSistema = 0,
	@IdTipoLicencia = '2AF9003D-220A-4C1C-B806-929F4FFC0802'

Execute Catalogo.ModuloXMenuXLicencia_SELECT
	@Activo = 1,
	@esSistema = 0,
	@IdTipoLicencia = '4B25C65B-2969-4348-B334-4E91529DCED1'



	Execute Catalogo.ModuloXMenuXLicencia_SELECT
	@Activo = 1,
	@esSistema = 0,
	@IdTipoLicencia = '14D9B476-198A-40EC-A493-ED729A377312'

select * from Catalogo.TipoLicencia

Execute Catalogo.ModuloXMenuXLicencia_SELECT
	@Activo = 1,
	@esSistema = 0,
	@IdTipoLicencia = 'A6FA6E5D-FCF3-4FC8-8283-749AD0992295'


	-- Verificar
SELECT *
FROM Catalogo.PlantillaAnalitica
ORDER BY FechaRegistro;
Select * From [Empresa].[CuentaContable]

        SELECT TOP 1 ISNULL(NombreCuenta, NombreCuenta) AS NombreCuenta
            FROM [Empresa].[CuentaContable]
            WHERE CodigoCuenta = @cuenta
              --AND IdEmpresa = (SELECT IdEmpresa FROM Empresa.Empresa WHERE Codigo = @empresa)
            ORDER BY CodigoCuenta


 SELECT TOP 1 ISNULL(NombreCuenta, NombreCuenta) AS NombreCuenta
            FROM [Empresa].[CuentaContable]
            WHERE CodigoCuenta = '1'
              --AND IdEmpresa = (SELECT IdEmpresa FROM Empresa.Empresa WHERE Codigo = @empresa)
            ORDER BY Codigo

SELECT * 
		From   [Empresa].[MovimientoContable]


    SELECT ISNULL(SUM(
        
            m.Cargo - Abono
       
    ), 0)
    FROM [Empresa].[MovimientoContable] m
    INNER JOIN Registro.Empresa e ON e.IdEmpresa = m.IdEmpresa
	Inner Join [Empresa].[CuentaContable] Cuenta On Cuenta.IdCuentaContable = m.IdCuentaContable
    WHERE Cuenta.CodigoCuenta LIKE @cuenta + '%'
        AND Year(m.FechaMovimiento) = @año
        AND Month(m.FechaMovimiento) <= @periodo