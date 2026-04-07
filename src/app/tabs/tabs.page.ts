import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: false,
})
export class TabsPage {
  constructor(private readonly router: Router) {}

  /** RouterLink on ion-tab-button is unreliable in Capacitor WebView; navigate in code. */
  goTab(url: string): void {
    void this.router.navigateByUrl(url);
  }
}
