import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { DoseLogPage } from './dose-log.page';
import { DoseLogPageRoutingModule } from './dose-log-routing.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, RouterModule, DoseLogPageRoutingModule],
  declarations: [DoseLogPage],
})
export class DoseLogPageModule {}
