import { Component, OnInit } from '@angular/core';
import { AuthService } from './services/auth.service';
import { MedDataService } from './services/med-data.service';
import { MedNotificationService } from './services/med-notification.service';
import { OnboardingService } from './services/onboarding.service';

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
    private readonly onboarding: OnboardingService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.medData.load();
    if (this.auth.isLoggedIn()) {
      await this.onboarding.migrateIfHasExistingData();
      await this.medNotif.initialize();
    }
  }
}
