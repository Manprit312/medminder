import { Component } from '@angular/core';
import { SubscriptionService } from '../../services/subscription.service';

@Component({
  selector: 'app-education',
  templateUrl: './education.page.html',
  styleUrls: ['./education.page.scss'],
  standalone: false,
})
export class EducationPage {
  constructor(readonly subscription: SubscriptionService) {}
}
