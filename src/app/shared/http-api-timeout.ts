import { Observable } from 'rxjs';
import { timeout } from 'rxjs/operators';

/** Free hosts (e.g. Render) may cold-start 60s+; avoid hanging forever. */
export const API_REQUEST_TIMEOUT_MS = 120_000;

export function withApiTimeout<T>(obs: Observable<T>): Observable<T> {
  return obs.pipe(timeout(API_REQUEST_TIMEOUT_MS));
}
