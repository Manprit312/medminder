import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { EducationPage } from './education.page';
import { EducationPageRoutingModule } from './education-routing.module';

@NgModule({
  imports: [CommonModule, IonicModule, RouterModule, EducationPageRoutingModule],
  declarations: [EducationPage],
})
export class EducationPageModule {}
