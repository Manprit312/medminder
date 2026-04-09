import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

/** Optional daily meal notes (personal memory aid; stored only on this device). */
export interface DailyMeals {
  breakfast: string;
  lunch: string;
  dinner: string;
}

const PREFIX = 'meal_log_v1_';

function emptyMeals(): DailyMeals {
  return { breakfast: '', lunch: '', dinner: '' };
}

@Injectable({ providedIn: 'root' })
export class MealLogService {
  async getForDate(isoDate: string): Promise<DailyMeals> {
    const { value } = await Preferences.get({ key: PREFIX + isoDate });
    if (!value) {
      return emptyMeals();
    }
    try {
      const o = JSON.parse(value) as Partial<DailyMeals>;
      return {
        breakfast: String(o.breakfast ?? '').trim(),
        lunch: String(o.lunch ?? '').trim(),
        dinner: String(o.dinner ?? '').trim(),
      };
    } catch {
      return emptyMeals();
    }
  }

  async saveForDate(isoDate: string, meals: DailyMeals): Promise<void> {
    const payload = JSON.stringify({
      breakfast: meals.breakfast.trim(),
      lunch: meals.lunch.trim(),
      dinner: meals.dinner.trim(),
    });
    await Preferences.set({ key: PREFIX + isoDate, value: payload });
  }
}
