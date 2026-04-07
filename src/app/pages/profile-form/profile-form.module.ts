import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { ProfileFormPage } from './profile-form.page';
import { ProfileFormPageRoutingModule } from './profile-form-routing.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, RouterModule, ProfileFormPageRoutingModule],
  declarations: [ProfileFormPage],
})
export class ProfileFormPageModule {}
