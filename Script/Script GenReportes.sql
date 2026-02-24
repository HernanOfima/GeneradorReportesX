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


Select * FRom [Empresa].[vReporte_ListadoProyectosCompra]

Select * from catalogo.modulo

Select * FRom Catalogo.Reportes

Execute Empresa.spReporte_DetalleSaldoInventarioProducto 'B62C2D64-D4FB-4010-976A-05166C324413',2024,12,Null

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
	