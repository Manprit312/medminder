import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CaretakingDetailPage } from './caretaking-detail.page';

const routes: Routes = [
  {
    path: '',
    component: CaretakingDetailPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CaretakingDetailPageRoutingModule {}
