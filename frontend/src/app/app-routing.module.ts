import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ReportViewerComponent } from './components/report-viewer/report-viewer.component';

const routes: Routes = [
  { path: '', component: ReportViewerComponent },
  { path: 'reports', component: ReportViewerComponent },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
