import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { VitalsPage } from './vitals.page';
import { VitalsPageRoutingModule } from './vitals-routing.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, RouterModule, VitalsPageRoutingModule],
  declarations: [VitalsPage],
})
export class VitalsPageModule {}
