import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { ResetPasswordPage } from './reset-password.page';
import { ResetPasswordPageRoutingModule } from './reset-password-routing.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule,
    ResetPasswordPageRoutingModule,
  ],
  declarations: [ResetPasswordPage],
})
export class ResetPasswordPageModule {}
