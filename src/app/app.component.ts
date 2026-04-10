import { Component, OnInit } from '@angular/core';
import { AuthService } from './services/auth.service';
import { MedDataService } from './services/med-data.service';
import { MedNotificationService } from './services/med-notification.service';
import { OnboardingService } from './services/onboarding.service';
import { SubscriptionService } from './services/subscription.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  constructor(
    private readonly auth: AuthService,
    private readonly medData: MedDataService,
    private readonly medNotif: MedNotificationService,
    private readonly onboarding: OnboardingService,
    private readonly subscription: SubscriptionService
  ) {}

  async ngOnInit(): Promise<void> {
    // Do not await load(): Render free tier cold-starts can take 60–120s and would block the shell.
    if (this.auth.isLoggedIn()) {
      void this.subscription.refreshFromApi();
      await this.medNotif.registerNotificationListeners();
      void this.medData.load().then(async () => {
        void this.onboarding.migrateIfHasExistingData();
        await this.medNotif.syncScheduleFromMedications();
      });
    } else {
      void this.medData.load();
    }
  }
}
