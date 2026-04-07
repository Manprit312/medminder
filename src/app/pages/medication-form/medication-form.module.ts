import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { MedicationFormPage } from './medication-form.page';
import { MedicationFormPageRoutingModule } from './medication-form-routing.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, RouterModule, MedicationFormPageRoutingModule],
  declarations: [MedicationFormPage],
})
export class MedicationFormPageModule {}
