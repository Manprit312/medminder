import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { ForgotPasswordPage } from './forgot-password.page';
import { ForgotPasswordPageRoutingModule } from './forgot-password-routing.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule,
    ForgotPasswordPageRoutingModule,
  ],
  declarations: [ForgotPasswordPage],
})
export class ForgotPasswordPageModule {}
