import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TabsPage } from './tabs.page';
import { TabsPageRoutingModule } from './tabs-routing.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, RouterModule, TabsPageRoutingModule],
  declarations: [TabsPage],
})
export class TabsPageModule {}
