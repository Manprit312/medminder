import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { CaretakerAlertsService } from '../../services/caretaker-alerts.service';
import { FirebaseAuthService } from '../../services/firebase-auth.service';
import { MedDataService } from '../../services/med-data.service';
import { MedNotificationService } from '../../services/med-notification.service';

interface SplashSlide {
  id: string;
  tagline: string;
  desc: string;
  image: string;
}

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage implements OnInit, OnDestroy {
  readonly slides: SplashSlide[] = [
    {
      id: 'reminders',
      tagline: 'Stay on Track, Stay Healthy',
      desc: 'Never miss a dose — smart reminders keep every medicine on schedule.',
      image: 'assets/illustrations/onboarding-clock.png',
    },
    {
      id: 'organise',
      tagline: 'Organise Every Medicine',
      desc: 'Track doses, refills and schedules all in one simple place.',
      image: 'assets/illustrations/onboarding-pills.png',
    },
    {
      id: 'family',
      tagline: 'Keep Everyone Healthy',
      desc: 'Create profiles for loved ones and share care with your family.',
      image: 'assets/illustrations/onboarding-family.png',
    },
  ];

  currentSlide = 0;

  private touchStartX = 0;
  private autoTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly auth: AuthService,
    private readonly caretakerAlerts: CaretakerAlertsService,
    private readonly firebaseAuth: FirebaseAuthService,
    private readonly medData: MedDataService,
    private readonly medNotif: MedNotificationService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly alertCtrl: AlertController,
    private readonly loadingCtrl: LoadingController
  ) {}

  ngOnInit(): void {
    void this.finishGoogleRedirectIfPresent();
    this.startAutoSlide();
  }

  ngOnDestroy(): void {
    this.stopAutoSlide();
  }

  setSlide(index: number): void {
    this.currentSlide = index;
    this.stopAutoSlide();
    this.startAutoSlide();
  }

  onTouchStart(ev: TouchEvent): void {
    this.touchStartX = ev.touches[0]?.clientX ?? 0;
  }

  onTouchEnd(ev: TouchEvent): void {
    const endX = ev.changedTouches[0]?.clientX ?? 0;
    const diff = this.touchStartX - endX;
    if (Math.abs(diff) < 40) {
      return;
    }
    if (diff > 0 && this.currentSlide < this.slides.length - 1) {
      this.setSlide(this.currentSlide + 1);
    } else if (diff < 0 && this.currentSlide > 0) {
      this.setSlide(this.currentSlide - 1);
    }
  }

  private startAutoSlide(): void {
    this.autoTimer = setInterval(() => {
      this.currentSlide = (this.currentSlide + 1) % this.slides.length;
    }, 4000);
  }

  private stopAutoSlide(): void {
    if (this.autoTimer !== undefined) {
      clearInterval(this.autoTimer);
      this.autoTimer = undefined;
    }
  }

  async signInWithGoogle(): Promise<void> {
    this.stopAutoSlide();
    const loading = await this.loadingCtrl.create({ message: 'Connecting Google…' });
    await loading.present();
    try {
      const idToken = await this.firebaseAuth.getGoogleIdToken();
      await this.auth.loginWithGoogleIdToken(idToken);
      await this.finishLogin();
      await loading.dismiss();
    } catch (e: unknown) {
      await loading.dismiss();
      if (this.firebaseAuth.isRedirectInitiatedError(e)) {
        return;
      }
      await this.showErr('Google sign-in failed', e, 'Try again in a moment.');
    }
  }

  private async finishGoogleRedirectIfPresent(): Promise<void> {
    try {
      const idToken = await this.firebaseAuth.consumeGoogleRedirectResult();
      if (!idToken) {
        return;
      }
      await this.auth.loginWithGoogleIdToken(idToken);
      await this.finishLogin();
    } catch (e) {
      await this.showErr('Google sign-in failed', e, 'Could not complete Google redirect sign-in.');
    }
  }

  private async finishLogin(): Promise<void> {
    this.stopAutoSlide();
    await this.caretakerAlerts.start();
    await this.medData.refresh();
    await this.medNotif.initialize();
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    const safe =
      returnUrl &&
      returnUrl.startsWith('/') &&
      !returnUrl.startsWith('//') &&
      !returnUrl.includes('://')
        ? returnUrl
        : null;
    await this.router.navigateByUrl(safe ?? '/tabs/today', { replaceUrl: true });
  }

  private async showErr(header: string, e: unknown, fallback: string): Promise<void> {
    let msg = fallback;
    if (e instanceof HttpErrorResponse) {
      const body = e.error as { error?: string } | undefined;
      if (e.status === 0) {
        msg = 'Could not reach the server. Check internet connection and try again.';
      } else {
        msg = body?.error ?? e.message;
      }
    } else if (e instanceof Error && e.message.trim()) {
      msg = e.message;
    } else if (typeof e === 'object' && e && 'code' in e) {
      const code = String((e as { code: unknown }).code ?? '').trim();
      const message =
        'message' in e ? String((e as { message: unknown }).message ?? '').trim() : '';
      msg = [code, message].filter(Boolean).join(': ') || fallback;
    }
    const alert = await this.alertCtrl.create({
      header,
      message: msg || fallback,
      buttons: ['OK'],
    });
    await alert.present();
  }
}
