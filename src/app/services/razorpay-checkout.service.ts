import { Injectable } from '@angular/core';

export interface RazorpayOrderParams {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  /** Prefill shown in Razorpay modal (optional) */
  prefill?: { name?: string; email?: string };
}

export interface RazorpayPaymentResult {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

/** Type stub for Razorpay checkout.js loaded via CDN. */
declare const Razorpay: new (opts: unknown) => { open(): void };

const CHECKOUT_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

@Injectable({ providedIn: 'root' })
export class RazorpayCheckoutService {
  private scriptLoaded = false;

  /** Injects the checkout.js CDN script once; resolves when ready. */
  private loadScript(): Promise<void> {
    if (this.scriptLoaded) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const existing = document.querySelector(`script[src="${CHECKOUT_SCRIPT_URL}"]`);
      if (existing) {
        this.scriptLoaded = true;
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = CHECKOUT_SCRIPT_URL;
      script.onload = () => {
        this.scriptLoaded = true;
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load Razorpay checkout script.'));
      document.body.appendChild(script);
    });
  }

  /**
   * Opens the Razorpay payment modal.
   * Resolves with payment result on success, rejects if the user dismisses or payment fails.
   */
  openCheckout(params: RazorpayOrderParams): Promise<RazorpayPaymentResult> {
    return this.loadScript().then(
      () =>
        new Promise<RazorpayPaymentResult>((resolve, reject) => {
          const rzp = new Razorpay({
            key: params.keyId,
            amount: params.amount,
            currency: params.currency,
            name: 'MedMinder',
            description: 'MedMinder Plus — Lifetime access',
            order_id: params.orderId,
            image: 'assets/icon/icon.png',
            prefill: params.prefill ?? {},
            theme: { color: '#4a6840' },
            handler: (response: RazorpayPaymentResult) => resolve(response),
            modal: {
              ondismiss: () => reject(new Error('Payment cancelled.')),
            },
          });
          rzp.open();
        })
    );
  }
}
