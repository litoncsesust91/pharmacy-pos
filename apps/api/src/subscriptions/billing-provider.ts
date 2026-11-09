export interface BillingProvider {
  readonly name: string;
  createSubscription(input: { tenantId: string; planKey: string }): Promise<{ customerId: string; subscriptionId: string }>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  verifyWebhook(payload: string, signature: string | undefined): boolean;
}

export class LocalBillingProvider implements BillingProvider {
  readonly name = 'local';

  async createSubscription(input: { tenantId: string; planKey: string }) {
    return { customerId: `local-customer:${input.tenantId}`, subscriptionId: `local-subscription:${input.tenantId}:${input.planKey}` };
  }

  async cancelSubscription(subscriptionId?: string): Promise<void> { void subscriptionId; }

  verifyWebhook(payload: string, signature: string | undefined) {
    const secret = process.env.BILLING_WEBHOOK_SECRET;
    if (!secret || !signature) return process.env.NODE_ENV !== 'production';
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    const actual = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
  }
}
import { createHmac, timingSafeEqual } from 'node:crypto';
