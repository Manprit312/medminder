import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MedicationFormPage } from './medication-form.page';

const routes: Routes = [
  {
    path: '',
    component: MedicationFormPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MedicationFormPageRoutingModule {}
