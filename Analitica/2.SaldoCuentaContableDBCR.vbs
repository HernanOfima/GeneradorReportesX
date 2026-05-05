Public Function SaldoCuentaContableDBCR(pCuenta As String, pPeriodo As Integer, _
    pTipo As String, pEmpresa As String, pAno As Integer) As Variant
    
' Funcion Debito o Credito de Cuentas Contables desde SALDCONT,
' este saldo solo se realiza de un Año y Periodo dados.
' segun parametro definido por el usuario.
' PARAMETROS
' pCuenta    : Codigo de la Cuenta
' pPeriodo   : Periodo
' pTipo      : DB=Debito, CR: Credito
' pEmpresa   : Nombre de la Empresa
' pAno       : Año

    '------------------------------------------------------------------------
    ' Se valida que los parametros que recibe la funcion sean los correctos
    
    ' Validacion Codigo de la Cuenta : Que NO venga el parametro en Blanco
    If LTrim(RTrim(pCuenta)) = "" Then
        SaldoCuentaContableDBCR = 0
        Exit Function
    End If
    
    ' Validacion Nombre de la Empresa : Que NO venga en blanco
    If LTrim(RTrim(pEmpresa)) = "" Then
        SaldoCuentaContableDBCR = 0
        Exit Function
    End If
    
    ' Validacion tipo de Saldo : "DB":Debito, "CR": Credito
    If UCase(Trim(pTipo)) <> "DB" And UCase(Trim(pTipo)) <> "CR" Then
        SaldoCuentaContableDBCR = 0
        Exit Function
    End If
    
    ' Validacion Periodo : Que sea un numero entre 1 y 12
    If pPeriodo < 1 Or pPeriodo > 12 Then
        SaldoCuentaContableDBCR = 0
        Exit Function
    End If

    ' Validacion Año: Que NO sea cero (0)
    If pAno = 0 Then
        SaldoCuentaContableDBCR = 0
        Exit Function
    End If
    

    Dim mConexionGenRep As ADODB.Connection

    ' Valido si la conexion esta activa o no para hacer el recordset
    Set mConexionGenRep = Validar_Conexion(pEmpresa, "E")
    
    If mConexionGenRep <> "" Then
    
        '-----------------------------
        ' - rsFunContable = Recordset(Conjunto de datos, Query o Consulta de Saldos Cuentas).
        Set rsFunContable = New ADODB.Recordset
                    
        If pTipo = "DB" Then
            mSqlStr = "Select  S.Ano,S.Periodo,S.CodigoCta,"
            mSqlStr = mSqlStr + "    Sum(S.Debito) As Total"
            mSqlStr = mSqlStr + "    From  SaldCont S, Cuentas C "
            mSqlStr = mSqlStr + "    Where S.CodigoCta = C.CodigoCta And "
            mSqlStr = mSqlStr + "    S.Ano = " + Str(pAno) + " And S.Periodo = " + Str(pPeriodo) + "  And "
            mSqlStr = mSqlStr + " S.CodigoCta Like '" + Trim(pCuenta) + "%' "
            mSqlStr = mSqlStr + " Group By S.Ano,S.Periodo,S.CodigoCta "
            mSqlStr = mSqlStr + " Order By 1,2,3 "
        Else
            mSqlStr = "Select  S.Ano,S.Periodo,S.CodigoCta,"
            mSqlStr = mSqlStr + "    Sum(S.Credito)  As Total"
            mSqlStr = mSqlStr + "    From  SaldCont S, Cuentas C "
            mSqlStr = mSqlStr + "    Where S.CodigoCta = C.CodigoCta And "
            mSqlStr = mSqlStr + "    S.Ano = " + Str(pAno) + " And S.Periodo = " + Str(pPeriodo) + "  And "
            mSqlStr = mSqlStr + " S.CodigoCta Like '" + Trim(pCuenta) + "%' "
            mSqlStr = mSqlStr + " Group By S.Ano,S.Periodo,S.CodigoCta "
            mSqlStr = mSqlStr + " Order By 1,2,3 "
        End If
        
        rsFunContable.Open Source:=mSqlStr, ActiveConnection:=mConexionGenRep, CursorType:=adOpenStatic
        
        
        ' Esta variable contiene el numero de registros obtenidos de la consulta.
        mTotalRegistros = rsFunContable.RecordCount
        
        ' ---------------------------------------
        ' Validar que hayan quedado datos en el
        ' Recordset(conjunto de datos) en Saldos Cuentas
         
         mSaldo = 0
        
        If Not rsFunContable.EOF Then
             While Not rsFunContable.EOF
             
                mSaldo = mSaldo + rsFunContable.Fields("Total").Value
                
                rsFunContable.MoveNext
                
             Wend
             
             SaldoCuentaContableDBCR = Val(Str(mSaldo))
        Else
            SaldoCuentaContableDBCR = 0
        End If
    Else
        SaldoCuentaContableDBCR = 0
    End If
   
End Function

