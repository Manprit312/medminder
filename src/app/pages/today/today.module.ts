import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { TodayPage } from './today.page';
import { TodayPageRoutingModule } from './today-routing.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, RouterModule, TodayPageRoutingModule],
  declarations: [TodayPage],
})
export class TodayPageModule {}
