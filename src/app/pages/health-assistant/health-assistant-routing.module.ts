import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HealthAssistantPage } from './health-assistant.page';

const routes: Routes = [
  {
    path: '',
    component: HealthAssistantPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class HealthAssistantPageRoutingModule {}

