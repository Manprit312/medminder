import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CareTeamPage } from './care-team.page';

const routes: Routes = [
  {
    path: '',
    component: CareTeamPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CareTeamPageRoutingModule {}
