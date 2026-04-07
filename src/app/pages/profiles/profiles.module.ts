import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { ProfilesPage } from './profiles.page';
import { ProfilesPageRoutingModule } from './profiles-routing.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, RouterModule, ProfilesPageRoutingModule],
  declarations: [ProfilesPage],
})
export class ProfilesPageModule {}
