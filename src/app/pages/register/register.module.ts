import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { RegisterPage } from './register.page';
import { RegisterPageRoutingModule } from './register-routing.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, RouterModule, RegisterPageRoutingModule],
  declarations: [RegisterPage],
})
export class RegisterPageModule {}
