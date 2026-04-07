import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DoseLogPage } from './dose-log.page';

const routes: Routes = [
  {
    path: '',
    component: DoseLogPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DoseLogPageRoutingModule {}
