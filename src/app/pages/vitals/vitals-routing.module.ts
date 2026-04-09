import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { VitalsPage } from './vitals.page';

const routes: Routes = [
  {
    path: '',
    component: VitalsPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class VitalsPageRoutingModule {}
