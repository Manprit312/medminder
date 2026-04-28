import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: false,
})
export class RegisterPage implements OnInit {
  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Registration is via Google Sign-In only — redirect straight to login,
    // preserving any returnUrl so the user lands in the right place after signing in.
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    const extras = returnUrl ? { queryParams: { returnUrl } } : {};
    void this.router.navigate(['/login'], { replaceUrl: true, ...extras });
  }
}
