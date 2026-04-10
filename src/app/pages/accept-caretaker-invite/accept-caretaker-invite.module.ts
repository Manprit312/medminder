import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { AcceptCaretakerInvitePage } from './accept-caretaker-invite.page';
import { AcceptCaretakerInvitePageRoutingModule } from './accept-caretaker-invite-routing.module';

@NgModule({
  imports: [CommonModule, IonicModule, RouterModule, AcceptCaretakerInvitePageRoutingModule],
  declarations: [AcceptCaretakerInvitePage],
})
export class AcceptCaretakerInvitePageModule {}
