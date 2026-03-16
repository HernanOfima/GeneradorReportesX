import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Router } from '@angular/router';

export interface User {
  username: string;
  isAuthenticated: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser: Observable<User | null>;

  // Credenciales hardcodeadas
  private readonly VALID_USERNAME = 'adminreporte';
  private readonly VALID_PASSWORD = 'Admin123.*';

  constructor(private router: Router) {
    const storedUser = localStorage.getItem('currentUser');
    this.currentUserSubject = new BehaviorSubject<User | null>(
      storedUser ? JSON.parse(storedUser) : null
    );
    this.currentUser = this.currentUserSubject.asObservable();
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  public get isAuthenticated(): boolean {
    return this.currentUserValue?.isAuthenticated || false;
  }

  login(username: string, password: string): Observable<boolean> {
    return new Observable(observer => {
      // Simular delay de autenticación
      setTimeout(() => {
        if (username === this.VALID_USERNAME && password === this.VALID_PASSWORD) {
          const user: User = {
            username: username,
            isAuthenticated: true
          };
          
          // Guardar usuario en localStorage
          localStorage.setItem('currentUser', JSON.stringify(user));
          this.currentUserSubject.next(user);
          
          observer.next(true);
          observer.complete();
        } else {
          observer.next(false);
          observer.complete();
        }
      }, 1000); // Simular 1 segundo de delay
    });
  }

  logout(): void {
    // Remover usuario del localStorage
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  // Método para verificar si el usuario está autenticado
  isLoggedIn(): boolean {
    const user = this.currentUserValue;
    return user !== null && user.isAuthenticated;
  }
}
