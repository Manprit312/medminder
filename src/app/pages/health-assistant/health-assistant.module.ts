import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { HealthAssistantPage } from './health-assistant.page';
import { HealthAssistantPageRoutingModule } from './health-assistant-routing.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, RouterModule, HealthAssistantPageRoutingModule],
  declarations: [HealthAssistantPage],
})
export class HealthAssistantPageModule {}

