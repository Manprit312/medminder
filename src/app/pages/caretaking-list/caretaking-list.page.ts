import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ViewWillEnter } from '@ionic/angular';
import { CaretakerApiService, CaretakingProfileRef } from '../../services/caretaker-api.service';

@Component({
  selector: 'app-caretaking-list',
  templateUrl: './caretaking-list.page.html',
  styleUrls: ['./caretaking-list.page.scss'],
  standalone: false,
})
export class CaretakingListPage implements ViewWillEnter {
  profiles: CaretakingProfileRef[] = [];
  loadError: string | null = null;
  loading = true;

  constructor(
    private readonly caretakerApi: CaretakerApiService,
    private readonly router: Router
  ) {}

  async ionViewWillEnter(): Promise<void> {
    this.loading = true;
    this.loadError = null;
    try {
      this.profiles = await this.caretakerApi.listCaretakingProfiles();
    } catch {
      this.loadError = 'Could not load people you care for.';
      this.profiles = [];
    } finally {
      this.loading = false;
    }
  }

  openProfile(p: CaretakingProfileRef): void {
    void this.router.navigate(['/tabs', 'caring', p.id]);
  }
}
