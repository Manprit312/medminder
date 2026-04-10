import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { CaretakingDetailPage } from './caretaking-detail.page';
import { CaretakingDetailPageRoutingModule } from './caretaking-detail-routing.module';

@NgModule({
  imports: [CommonModule, IonicModule, RouterModule, CaretakingDetailPageRoutingModule],
  declarations: [CaretakingDetailPage],
})
export class CaretakingDetailPageModule {}
