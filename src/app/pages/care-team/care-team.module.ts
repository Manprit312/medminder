import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { CareTeamPage } from './care-team.page';
import { CareTeamPageRoutingModule } from './care-team-routing.module';

@NgModule({
  imports: [CommonModule, IonicModule, RouterModule, CareTeamPageRoutingModule],
  declarations: [CareTeamPage],
})
export class CareTeamPageModule {}
