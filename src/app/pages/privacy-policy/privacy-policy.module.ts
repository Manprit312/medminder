import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { PrivacyPolicyPage } from './privacy-policy.page';
import { PrivacyPolicyPageRoutingModule } from './privacy-policy-routing.module';

@NgModule({
  imports: [CommonModule, IonicModule, RouterModule, PrivacyPolicyPageRoutingModule],
  declarations: [PrivacyPolicyPage],
})
export class PrivacyPolicyPageModule {}
