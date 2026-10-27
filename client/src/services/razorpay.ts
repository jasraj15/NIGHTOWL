/**
 * Loads the official Razorpay Checkout script on demand.
 * The script is only ever loaded with the PUBLIC key id returned by the backend;
 * the key secret and webhook secret never reach the browser.
 */
const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

let loading: Promise<boolean> | null = null;

export function loadRazorpayCheckout(): Promise<boolean> {
  if (typeof window !== 'undefined' && window.Razorpay) return Promise.resolve(true);
  if (loading) return loading;
  loading = new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      loading = null;
      resolve(false);
    };
    document.body.appendChild(script);
  });
  return loading;
}

export interface CheckoutSuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface OpenCheckoutInput {
  keyId: string;
  order: { id: string; amount: number; currency: string };
  payer: { name: string; email: string; contact?: string };
  description: string;
  onSuccess: (response: CheckoutSuccess) => void;
  onDismiss: () => void;
  onFailure: (reason: string) => void;
}

export async function openRazorpayCheckout(input: OpenCheckoutInput): Promise<void> {
  const ok = await loadRazorpayCheckout();
  if (!ok || !window.Razorpay) {
    input.onFailure('Could not load Razorpay Checkout. Check your connection and try again.');
    return;
  }
  const rzp = new window.Razorpay({
    key: input.keyId,
    amount: input.order.amount,
    currency: input.order.currency,
    order_id: input.order.id,
    name: 'NightOwl',
    description: input.description,
    image: `${window.location.origin}/owl-icon.svg`,
    prefill: { name: input.payer.name, email: input.payer.email, contact: input.payer.contact },
    theme: { color: '#CCFF00' },
    handler: (response: CheckoutSuccess) => input.onSuccess(response),
    modal: { ondismiss: () => input.onDismiss(), escape: true, backdropclose: false },
  });
  rzp.on('payment.failed', (resp: any) => {
    input.onFailure(resp?.error?.description || 'Payment failed at the provider.');
  });
  rzp.open();
}
