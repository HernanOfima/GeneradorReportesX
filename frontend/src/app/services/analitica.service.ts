import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CargarContextoRequest,
  ContextoDatos,
  GuardarPlantillaRequest,
  PlantillaAnalitica
} from '../models/analitica.models';

@Injectable({
  providedIn: 'root'
})
export class AnaliticaService {
  private readonly apiUrl = `${environment.apiUrl}/Analitica`;

  constructor(private http: HttpClient) {}

  cargarContexto(request: CargarContextoRequest): Observable<ContextoDatos> {
    return this.http.post<ContextoDatos>(`${this.apiUrl}/CargarContexto`, request).pipe(
      catchError(error => {
        console.error('Error cargando contexto:', error);
        throw error;
      })
    );
  }

  getPlantillas(): Observable<PlantillaAnalitica[]> {
    return this.http.get<PlantillaAnalitica[]>(`${this.apiUrl}/Plantillas`).pipe(
      catchError(() => of([]))
    );
  }

  getPlantilla(id: string): Observable<PlantillaAnalitica> {
    return this.http.get<PlantillaAnalitica>(`${this.apiUrl}/Plantillas/${id}`);
  }

  guardarPlantilla(request: GuardarPlantillaRequest): Observable<PlantillaAnalitica> {
    return this.http.post<PlantillaAnalitica>(`${this.apiUrl}/Plantillas`, request);
  }

  eliminarPlantilla(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/Plantillas/${id}`);
  }
}
