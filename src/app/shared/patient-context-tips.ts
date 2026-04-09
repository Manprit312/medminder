import type { PatientGroup } from '../models/med.models';

/** Short label for selects and chips. */
export const PATIENT_GROUP_OPTIONS: { value: PatientGroup; label: string; sub?: string }[] = [
  { value: 'infant', label: 'Infant or baby', sub: 'Caregiver gives doses' },
  { value: 'child', label: 'Child or teen' },
  { value: 'adult', label: 'Adult' },
  { value: 'older_adult', label: 'Older adult' },
  { value: 'pregnancy', label: 'Pregnancy or breastfeeding', sub: 'Discuss all meds with your clinician' },
];

const DISCLAIMER =
  'General organization tips only — not medical advice. Always follow your prescriber, pharmacist, or pediatrician.';

export function patientContextTips(group: PatientGroup | undefined): {
  title: string;
  bullets: string[];
  disclaimer: string;
} {
  const g = group ?? 'adult';
  switch (g) {
    case 'infant':
      return {
        title: 'Reminders for caregivers',
        bullets: [
          'Use alerts as a checklist—doses are given by a caregiver, not by the child.',
          'Store medicines safely, out of reach; keep measuring devices (syringe, dropper) as your pharmacist showed you.',
          'MedMinder only tracks the times you enter—it does not check if a medicine is appropriate for an infant.',
        ],
        disclaimer: DISCLAIMER,
      };
    case 'child':
      return {
        title: 'Reminders for families',
        bullets: [
          'Have a consistent adult confirm each dose; reminders help build routine around school and activities.',
          'If your child needs medicine at school or camp, follow your school’s policy and your clinician’s written instructions.',
          'This app does not replace the medicine label or your clinician’s directions.',
        ],
        disclaimer: DISCLAIMER,
      };
    case 'older_adult':
      return {
        title: 'Staying organized',
        bullets: [
          'Pair reminders with a pill organizer or pharmacy packaging if that helps you stay on track.',
          'Ask your pharmacist for a yearly medication review, especially if you see multiple doctors.',
          'Large-display devices and clear alarm sounds can make alerts easier to notice.',
        ],
        disclaimer: DISCLAIMER,
      };
    case 'pregnancy':
      return {
        title: 'Important',
        bullets: [
          'Do not start, stop, or change any medicine or supplement for pregnancy or breastfeeding without your obstetric or maternity provider.',
          'Use MedMinder only to remember times your clinician has already approved.',
          'For questions about safety in pregnancy, your clinician and pharmacist are the right sources—not this app.',
        ],
        disclaimer: DISCLAIMER,
      };
    case 'adult':
    default:
      return {
        title: 'Healthy habits',
        bullets: [
          'Take medicines at the times your clinician prescribed; these reminders are scheduling aids only.',
          'Keep one list of all prescriptions and supplements to share at appointments.',
          'Refill estimates here are approximate—confirm with your pharmacy when you’re running low.',
        ],
        disclaimer: DISCLAIMER,
      };
  }
}
