import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';

/**
 * User-facing text for failed API calls. Avoid relying only on `instanceof HttpErrorResponse`
 * (can fail across bundled copies in Capacitor/WebView).
 */
export function formatApiError(e: unknown): string {
  if (e instanceof TimeoutError) {
    return 'The server took too long to respond. Try again in a moment.';
  }
  if (e instanceof Error && e.name === 'TimeoutError') {
    return 'The server took too long to respond. Try again in a moment.';
  }

  if (e instanceof HttpErrorResponse) {
    return messageFromHttpLike(e);
  }

  if (e !== null && typeof e === 'object' && 'status' in e) {
    return messageFromHttpLike(e as HttpErrorResponse);
  }

  if (e instanceof Error) {
    return e.message;
  }
  return 'Request failed';
}

function messageFromHttpLike(e: Pick<HttpErrorResponse, 'status' | 'statusText' | 'message' | 'error'>): string {
  const err = e.error;
  if (err && typeof err === 'object' && 'error' in err && typeof (err as { error: unknown }).error === 'string') {
    return (err as { error: string }).error;
  }
  if (typeof err === 'string' && err.length > 0 && err.length < 600) {
    return err;
  }
  if (e.message) {
    return e.message;
  }
  if (e.status === 0) {
    return 'No response from server. Check connection, API URL, and try again after a short wait.';
  }
  return `${e.status} ${e.statusText ?? ''}`.trim() || 'Request failed';
}
