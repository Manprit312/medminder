import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      {
        path: 'today/dose/:medicationId/:timeToken',
        loadChildren: () =>
          import('../pages/dose-log/dose-log.module').then((m) => m.DoseLogPageModule),
      },
      {
        path: 'today',
        loadChildren: () =>
          import('../pages/today/today.module').then((m) => m.TodayPageModule),
      },
      {
        path: 'profiles/add',
        loadChildren: () =>
          import('../pages/profile-form/profile-form.module').then((m) => m.ProfileFormPageModule),
      },
      {
        path: 'profiles/:id/edit',
        loadChildren: () =>
          import('../pages/profile-form/profile-form.module').then((m) => m.ProfileFormPageModule),
      },
      {
        path: 'profiles/:id/medications/add',
        loadChildren: () =>
          import('../pages/medication-form/medication-form.module').then(
            (m) => m.MedicationFormPageModule
          ),
      },
      {
        path: 'profiles/:id/medications/:medId',
        loadChildren: () =>
          import('../pages/medication-form/medication-form.module').then(
            (m) => m.MedicationFormPageModule
          ),
      },
      {
        path: 'profiles/:id',
        loadChildren: () =>
          import('../pages/profile-detail/profile-detail.module').then(
            (m) => m.ProfileDetailPageModule
          ),
      },
      {
        path: 'profiles',
        loadChildren: () =>
          import('../pages/profiles/profiles.module').then((m) => m.ProfilesPageModule),
      },
      {
        path: 'caring/:profileId',
        loadChildren: () =>
          import('../pages/caretaking-detail/caretaking-detail.module').then(
            (m) => m.CaretakingDetailPageModule
          ),
      },
      {
        path: 'caring',
        loadChildren: () =>
          import('../pages/caretaking-list/caretaking-list.module').then(
            (m) => m.CaretakingListPageModule
          ),
      },
      {
        path: 'settings/education',
        loadChildren: () =>
          import('../pages/education/education.module').then((m) => m.EducationPageModule),
      },
      {
        path: 'settings/care-team',
        loadChildren: () =>
          import('../pages/care-team/care-team.module').then((m) => m.CareTeamPageModule),
      },
      {
        path: 'settings/vitals',
        loadChildren: () => import('../pages/vitals/vitals.module').then((m) => m.VitalsPageModule),
      },
      {
        path: 'settings',
        loadChildren: () =>
          import('../pages/settings/settings.module').then((m) => m.SettingsPageModule),
      },
      {
        path: '',
        redirectTo: 'today',
        pathMatch: 'full',
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TabsPageRoutingModule {}
