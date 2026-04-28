import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { CaretakerApiService } from '../../services/caretaker-api.service';
import { MedDataService } from '../../services/med-data.service';

@Component({
  selector: 'app-accept-caretaker-invite',
  templateUrl: './accept-caretaker-invite.page.html',
  styleUrls: ['./accept-caretaker-invite.page.scss'],
  standalone: false,
})
export class AcceptCaretakerInvitePage implements OnInit {
  token = '';
  preview: { profileName: string } | null = null;
  previewError: string | null = null;
  loadingPreview = true;
  accepting = false;

  /** True only after the backend confirms the stored token is valid. */
  readonly sessionValid = signal(false);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly auth: AuthService,
    private readonly caretakerApi: CaretakerApiService,
    private readonly medData: MedDataService,
    private readonly alertCtrl: AlertController
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token')?.trim() ?? '';
    void this.init();
  }

  private async init(): Promise<void> {
    // Verify the stored token is still valid before showing "Accept invitation".
    // A stale token (e.g. after a DB reset) would cause a confusing 404.
    const valid = await this.auth.verifySession();
    this.sessionValid.set(valid);
    void this.loadPreview();
  }

  private async loadPreview(): Promise<void> {
    this.loadingPreview = true;
    this.previewError = null;
    if (!this.token) {
      this.previewError = 'Missing invite link. Open the link you were sent (for example in WhatsApp).';
      this.loadingPreview = false;
      return;
    }
    try {
      this.preview = await this.caretakerApi.previewInvite(this.token);
    } catch {
      this.previewError = 'This invite is invalid, expired, or already used.';
    } finally {
      this.loadingPreview = false;
    }
  }

  get returnUrlForAuth(): string {
    return `/accept-caretaker-invite?token=${encodeURIComponent(this.token)}`;
  }

  async accept(): Promise<void> {
    if (!this.token || !this.preview) {
      return;
    }
    this.accepting = true;
    try {
      await this.caretakerApi.acceptInvite(this.token);
      await this.medData.refresh();
      await this.router.navigateByUrl('/tabs/caring', { replaceUrl: true });
    } catch (err: unknown) {
      let message = 'Something went wrong. Try again in a moment.';
      if (err instanceof HttpErrorResponse) {
        if (err.status === 400 || err.status === 403) {
          message = 'You cannot accept your own invite. Share it with someone else.';
        } else if (err.status === 404) {
          message = 'This invite is invalid or was already used.';
        } else if (err.status === 410) {
          message = 'This invite has expired. Ask for a new invite.';
        } else if (err.status === 0) {
          message = 'Network error — check your connection and try again.';
        }
      }
      const a = await this.alertCtrl.create({
        header: 'Could not accept',
        message,
        buttons: ['OK'],
      });
      await a.present();
    } finally {
      this.accepting = false;
    }
  }
}
