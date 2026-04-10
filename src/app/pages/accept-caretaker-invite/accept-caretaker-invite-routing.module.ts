import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AcceptCaretakerInvitePage } from './accept-caretaker-invite.page';

const routes: Routes = [
  {
    path: '',
    component: AcceptCaretakerInvitePage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AcceptCaretakerInvitePageRoutingModule {}
