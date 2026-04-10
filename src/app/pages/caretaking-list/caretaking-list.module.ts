import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { CaretakingListPage } from './caretaking-list.page';
import { CaretakingListPageRoutingModule } from './caretaking-list-routing.module';

@NgModule({
  imports: [CommonModule, IonicModule, RouterModule, CaretakingListPageRoutingModule],
  declarations: [CaretakingListPage],
})
export class CaretakingListPageModule {}
