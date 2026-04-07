import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { ProfileDetailPage } from './profile-detail.page';
import { ProfileDetailPageRoutingModule } from './profile-detail-routing.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, RouterModule, ProfileDetailPageRoutingModule],
  declarations: [ProfileDetailPage],
})
export class ProfileDetailPageModule {}
