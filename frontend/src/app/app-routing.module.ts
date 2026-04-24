import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ReportViewerComponent } from './components/report-viewer/report-viewer.component';
import { LoginComponent } from './components/login/login.component';
import { AnaliticaSpreadsheetComponent } from './components/analitica-spreadsheet/analitica-spreadsheet.component';
import { AuthGuard } from './guards/auth.guard';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '', redirectTo: '/reports', pathMatch: 'full' },
  { path: 'reports', component: ReportViewerComponent, canActivate: [AuthGuard] },
  { path: 'analitica', component: AnaliticaSpreadsheetComponent, canActivate: [AuthGuard] },
  { path: '**', redirectTo: '/login' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
