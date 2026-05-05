Public Function SaldoCuentaContable(pCuentas As String, pPeriodo As Integer, _
    pAcumulado As String, pEmpresa As String, pAno As Integer) As Variant

    Dim rsFunContableCuenta, rsFunContableRango As ADODB.Recordset
'------------------------------------------------------------------------
    ' Se valida que los parametros que recibe la funcion sean los correctos
    
    ' Validacion Codigo de la Cuenta : Que NO venga el parametro en Blanco
    If LTrim(RTrim(pCuentas)) = "" Then
        SaldoCuentaContable = 0
        Exit Function
    End If
    
    ' Validacion Nombre de la Empresa : Que NO venga en blanco
    If LTrim(RTrim(pEmpresa)) = "" Then
        SaldoCuentaContable = 0
        Exit Function
    End If
    
    ' Validacion tipo de Saldo : "A":Acumulado, "M": Mensual
    If UCase(Trim(pAcumulado)) <> "A" And UCase(Trim(pAcumulado)) <> "M" Then
        SaldoCuentaContable = 0
        Exit Function
    End If
    
    ' Validacion Periodo : Que sea un numero entre 1 y 13
    If pPeriodo < 1 Or pPeriodo > 13 Then
        SaldoCuentaContable = 0
        Exit Function
    End If

    ' Validacion Año: Que NO sea cero (0)
    If pAno = 0 Then
        SaldoCuentaContable = 0
        Exit Function
    End If
    

    Dim mConexionGenRep As ADODB.Connection

    ' Valido si la conexion esta activa o no para hacer el recordset
    Set mConexionGenRep = Validar_Conexion(pEmpresa, "E")
    
    If mConexionGenRep <> "" Then
    
        'Dimensionamos el arreglo que  va a guardar la separaciòn de la cadena de cuentas
         Dim Val_Cadena() As String
        'se separa la cadena por grupos cada que encuentre la coma (,)
        
        Val_Cadena() = Split(pCuentas, ",")
        
        SumSaldoCuentas1 = 0
        SumSaldoCuentas2 = 0
        mSaldo = 0
        mNaturaleza = 0
        mDeudora = 0
        mAcreedora = 0
                
        'Se recorre el arreglo resultante
        For i = LBound(Val_Cadena) To UBound(Val_Cadena)
          'Si en cada separaciòn de la cadena se encuntra un guiòn(-) se ubica cuenta inicial y cuenta final
          If InStr(Val_Cadena(i), "-") > 0 Then
            'Asiganción de el ragon inicial y  final de las cuentas
            pCuenta = Mid(Val_Cadena(i), 1, InStr(Val_Cadena(i), "-") - 1)
            pCuenta2 = Mid(Val_Cadena(i), InStr(Val_Cadena(i), "-") + 1, Len(Val_Cadena(i)))
            
            'Se realiza la consulta  y acumulación respestiva  de los rangos de cuentas
                Set rsFunContableRango = New ADODB.Recordset
                
                If gPais = "MX" Then
                
                    
                    If pAcumulado = "A" Then
                        mSqlStr = "Select S.Ano, S.Periodo As Periodo,S.CodigoCta,c.naturaleza, "
                        mSqlStr = mSqlStr + " case when c.naturaleza=1 then  Sum(S.Credito)- Sum(S.Debito) else Sum(S.Debito) - Sum(S.Credito) end As Total "
                        mSqlStr = mSqlStr + " From  SaldCont S, Cuentas C "
                        mSqlStr = mSqlStr + " Where S.CodigoCta = C.CodigoCta And "
                        mSqlStr = mSqlStr + " ((S.Ano = " + Str(pAno) + " and S.periodo <= " + Str(pPeriodo) + ") OR(S.ANO < " + Str(pAno) + "))"
                        mSqlStr2 = " ((S.CodigoCta Between " + "'" + Trim(pCuenta) + "'" + " and " + "'" + Trim(pCuenta2) + "') or S.CodigoCta  Like " + "'" + Trim(pCuenta2) + "%')"
                        mSqlStr2 = mSqlStr2 + " Group By S.Ano,S.Periodo,S.CodigoCta,c.naturaleza "
                        mSqlStr2 = mSqlStr2 + " Order By 1,2,3 "
                    Else
                        mSqlStr = "Select  S.Ano,S.Periodo,S.CodigoCta,c.naturaleza,"
                        mSqlStr = mSqlStr + " case when c.naturaleza=1 then  Sum(S.Credito)- Sum(S.Debito) else Sum(S.Debito) - Sum(S.Credito) end As Total "
                        mSqlStr = mSqlStr + " From  SaldCont S, Cuentas C "
                        mSqlStr = mSqlStr + " Where S.CodigoCta = C.CodigoCta And "
                        mSqlStr = mSqlStr + " S.Ano = " + Str(pAno) + " And S.Periodo = " + Str(pPeriodo) + "  And "
                        mSqlStr2 = "((S.CodigoCta Between " + "'" + Trim(pCuenta) + "'" + " and " + "'" + Trim(pCuenta2) + "') or S.CodigoCta  Like " + "'" + Trim(pCuenta2) + "%')"
                        mSqlStr2 = mSqlStr2 + " or ( S.CodigoCta like " + "'" + Trim(pCuenta2) + "%'" + " And S.Ano = " + Str(pAno) + " And S.Periodo = " + Str(pPeriodo) + ")"
                        mSqlStr2 = mSqlStr2 + " Group By S.Ano,S.Periodo,S.CodigoCta,c.naturaleza "
                        mSqlStr2 = mSqlStr2 + " Order By 1,2,3 "
                    End If
                
                Else
                
                    If pAcumulado = "A" Then
                        mSqlStr = "Select S.Ano, S.Periodo As Periodo,S.CodigoCta, "
                        mSqlStr = mSqlStr + " Sum(S.Debito)-Sum(S.Credito)  As Total "
                        mSqlStr = mSqlStr + " From  SaldCont S, Cuentas C "
                        mSqlStr = mSqlStr + " Where S.CodigoCta = C.CodigoCta And "
                        mSqlStr = mSqlStr + " ((S.Ano = " + Str(pAno) + " and S.periodo <= " + Str(pPeriodo) + ") OR(S.ANO < " + Str(pAno) + "))"
                        mSqlStr2 = " ((S.CodigoCta Between " + "'" + Trim(pCuenta) + "'" + " and " + "'" + Trim(pCuenta2) + "') or S.CodigoCta  Like " + "'" + Trim(pCuenta2) + "%')"
                        mSqlStr2 = mSqlStr2 + " Group By S.Ano,S.Periodo,S.CodigoCta "
                        mSqlStr2 = mSqlStr2 + " Order By 1,2,3 "
                    Else
                        mSqlStr = "Select  S.Ano,S.Periodo,S.CodigoCta,"
                        mSqlStr = mSqlStr + " Sum(S.Debito)-Sum(S.Credito)  As Total"
                        mSqlStr = mSqlStr + " From  SaldCont S, Cuentas C "
                        mSqlStr = mSqlStr + " Where S.CodigoCta = C.CodigoCta And "
                        mSqlStr = mSqlStr + " S.Ano = " + Str(pAno) + " And S.Periodo = " + Str(pPeriodo) + "  And "
                         mSqlStr2 = " ((S.CodigoCta Between " + "'" + Trim(pCuenta) + "'" + " and " + "'" + Trim(pCuenta2) + "') or S.CodigoCta  Like " + "'" + Trim(pCuenta2) + "%')"
                        mSqlStr2 = mSqlStr2 + " or ( S.CodigoCta like " + "'" + Trim(pCuenta2) + "%'" + " And S.Ano = " + Str(pAno) + " And S.Periodo = " + Str(pPeriodo) + ")"
                        mSqlStr2 = mSqlStr2 + " Group By S.Ano,S.Periodo,S.CodigoCta "
                        mSqlStr2 = mSqlStr2 + " Order By 1,2,3 "
                    End If
                End If
                
                rsFunContableRango.Open Source:=mSqlStr + mSqlStr2, ActiveConnection:=mConexionGenRep, CursorType:=adOpenStatic
                ' Esta variable contiene el numero de registros obtenidos de la consulta.
                mTotalRegistros = rsFunContableRango.RecordCount
                ' ---------------------------------------
                ' Validar que hayan quedado datos en el
                ' Recordset(conjunto de datos) en Saldos Cuentas
                mSaldo = 0
                mNaturaleza = 0
               'mDeudora = 0
               'mAcreedora = 0
                
                If Not rsFunContableRango.EOF Then
                     While Not rsFunContableRango.EOF
                     
                        If rsFunContableRango.Fields("Total").Value <> 0 Then
                              
                            If gPais = "MX" Then
                                mNaturaleza = rsFunContableRango.Fields("Naturaleza").Value
                                mValor = rsFunContableRango.Fields("Total").Value
                                
                                If mNaturaleza = 0 Then
                                      mDeudora = mDeudora + mValor
                                Else
                                      mAcreedora = mAcreedora + mValor
                                End If
                            Else
                                mValor = rsFunContableRango.Fields("Total").Value
                                mSaldo = mSaldo + mValor
                            End If
                            
                        
                        End If
                        
                        rsFunContableRango.MoveNext
                        
                     Wend
                     
                     If gPais <> "MX" Then
                        SumSaldoCuentas1 = SumSaldoCuentas1 + Val(Str(mSaldo))
                     End If
                     
                Else
                     SumSaldoCuentas1 = SumSaldoCuentas1 + 0
                End If
    
          Else
             ' Asignaciòn de la cuenta
              pCuenta = Val_Cadena(i)
             'Se realiza la consulta  y acumulación respestiva  de las cuentas
              Set rsFunContableCuenta = New ADODB.Recordset
                If gPais = "MX" Then
                    
                      If pAcumulado = "A" Then
                          mSqlStr = "Select S.Ano, S.Periodo As Periodo,S.CodigoCta,c.naturaleza, "
                          mSqlStr = mSqlStr + "  case when c.naturaleza=1 then  Sum(S.Credito)- Sum(S.Debito) else Sum(S.Debito) - Sum(S.Credito) end As Total  "
                          mSqlStr = mSqlStr + " From  SaldCont S, Cuentas C "
                          mSqlStr = mSqlStr + " Where S.CodigoCta = C.CodigoCta And "
                          mSqlStr = mSqlStr + " ((S.Ano = " + Str(pAno) + " and S.periodo <= " + Str(pPeriodo) + ") OR(S.ANO < " + Str(pAno) + "))"
                          mSqlStr = mSqlStr + " And S.CodigoCta Like '" + Trim(pCuenta) + "%' "
                          mSqlStr = mSqlStr + " Group By S.Ano,S.Periodo,S.CodigoCta,c.naturaleza "
                          mSqlStr = mSqlStr + " Order By 1,2,3 "
                      Else
                          mSqlStr = "Select  S.Ano,S.Periodo,S.CodigoCta,c.naturaleza,"
                          mSqlStr = mSqlStr + "    case when c.naturaleza=1 then  Sum(S.Credito)- Sum(S.Debito) else Sum(S.Debito) - Sum(S.Credito) end As Total "
                          mSqlStr = mSqlStr + "    From  SaldCont S, Cuentas C "
                          mSqlStr = mSqlStr + "    Where S.CodigoCta = C.CodigoCta And "
                          mSqlStr = mSqlStr + "    S.Ano = " + Str(pAno) + " And S.Periodo = " + Str(pPeriodo) + "  And "
                          mSqlStr = mSqlStr + " S.CodigoCta Like '" + Trim(pCuenta) + "%' "
                          mSqlStr = mSqlStr + " Group By S.Ano,S.Periodo,S.CodigoCta,c.naturaleza "
                          mSqlStr = mSqlStr + " Order By 1,2,3 "
                      End If
                
                Else
                
                      If pAcumulado = "A" Then
                          mSqlStr = "Select S.Ano, S.Periodo As Periodo,S.CodigoCta, "
                          mSqlStr = mSqlStr + " Sum(S.Debito)-Sum(S.Credito)  As Total "
                          mSqlStr = mSqlStr + " From  SaldCont S, Cuentas C "
                          mSqlStr = mSqlStr + " Where S.CodigoCta = C.CodigoCta And "
                          mSqlStr = mSqlStr + " ((S.Ano = " + Str(pAno) + " and S.periodo <= " + Str(pPeriodo) + ") OR(S.ANO < " + Str(pAno) + "))"
                          mSqlStr = mSqlStr + " And S.CodigoCta Like '" + Trim(pCuenta) + "%' "
                          mSqlStr = mSqlStr + " Group By S.Ano,S.Periodo,S.CodigoCta "
                          mSqlStr = mSqlStr + " Order By 1,2,3 "
                      Else
                          mSqlStr = "Select  S.Ano,S.Periodo,S.CodigoCta,"
                          mSqlStr = mSqlStr + "    Sum(S.Debito)-Sum(S.Credito)  As Total"
                          mSqlStr = mSqlStr + "    From  SaldCont S, Cuentas C "
                          mSqlStr = mSqlStr + "    Where S.CodigoCta = C.CodigoCta And "
                          mSqlStr = mSqlStr + "    S.Ano = " + Str(pAno) + " And S.Periodo = " + Str(pPeriodo) + "  And "
                          mSqlStr = mSqlStr + " S.CodigoCta Like '" + Trim(pCuenta) + "%' "
                          mSqlStr = mSqlStr + " Group By S.Ano,S.Periodo,S.CodigoCta "
                          mSqlStr = mSqlStr + " Order By 1,2,3 "
                      End If
                End If
                
                rsFunContableCuenta.Open Source:=mSqlStr, ActiveConnection:=mConexionGenRep, CursorType:=adOpenStatic
                
                ' Esta variable contiene el numero de registros obtenidos de la consulta.
                
                mTotalRegistros = rsFunContableCuenta.RecordCount
                ' ---------------------------------------
                ' Validar que hayan quedado datos en el
                ' Recordset(conjunto de datos) en Saldos Cuentas
                mSaldo = 0
                mNaturaleza = 0
                'mDeudora = 0
                'mAcreedora = 0
                
                If Not rsFunContableCuenta.EOF Then
                     While Not rsFunContableCuenta.EOF
                     
                        If rsFunContableCuenta.Fields("Total").Value <> 0 Then
                        
                            If gPais = "MX" Then
                                mNaturaleza = rsFunContableCuenta.Fields("Naturaleza").Value
                                mValor = rsFunContableCuenta.Fields("Total").Value
                                
                                If mNaturaleza = 0 Then
                                      mDeudora = mDeudora + mValor
                                Else
                                      mAcreedora = mAcreedora + mValor
                                End If
                            Else
                                mValor = rsFunContableCuenta.Fields("Total").Value
                                mSaldo = mSaldo + mValor
                            End If
                            
                        End If

                        rsFunContableCuenta.MoveNext
                        
                     Wend
                     
                     If gPais <> "MX" Then
                        SumSaldoCuentas2 = SumSaldoCuentas2 + Val(Str(mSaldo))
                     End If
                     
                Else
                     SumSaldoCuentas2 = SumSaldoCuentas2 + 0
                End If
          End If
            
        Next i
       
        
        
         If gPais = "MX" Then
             
                If mDeudora <> 0 And mAcreedora = 0 Then
                    SaldoCuentaContable = mDeudora
                End If
                
                If mDeudora = 0 And mAcreedora <> 0 Then
                     SaldoCuentaContable = mAcreedora
                End If
                
                If mDeudora <> 0 And mAcreedora <> 0 Then
                    SaldoCuentaContable = (mDeudora - mAcreedora)
                End If
                    
         Else
                 'valor final del saldo de las cuentas solicitadas
                 SaldoCuentaContable = SumSaldoCuentas1 + SumSaldoCuentas2
         End If
    
    Else
        SaldoCuentaContable = 0
        
    End If

End Function


