import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { SubscriptionService } from '../services/subscription.service';

export type TabKey = 'today' | 'profiles' | 'caring' | 'settings';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: false,
})
export class TabsPage implements OnInit, OnDestroy {
  private routeSub?: Subscription;
  private path = '';

  constructor(
    private readonly router: Router,
    readonly subscription: SubscriptionService
  ) {}

  ngOnInit(): void {
    this.syncPath();
    this.routeSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.syncPath());
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  private syncPath(): void {
    this.path = this.router.url.split('?')[0];
  }

  /** Programmatic tab navigation does not set Ionic’s selected state — use this for an explicit `.mm-tab-active` class. */
  isActive(key: TabKey): boolean {
    const base = `/tabs/${key}`;
    return this.path === base || this.path.startsWith(`${base}/`);
  }

  /** RouterLink on ion-tab-button is unreliable in Capacitor WebView; navigate in code. */
  goTab(url: string): void {
    void this.router.navigateByUrl(url);
  }
}
