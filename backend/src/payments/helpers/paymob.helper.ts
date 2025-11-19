/**
 * Helper functions for Paymob payment integration
 */
import axios from 'axios';
import { Logger } from '@nestjs/common';

const logger = new Logger('PaymobHelper');

interface PaymobConfig {
  apiKey: string;
  integrationId: string;
  amountCents: number;
  orderId?: string;
}

/**
 * Create a Paymob payment order and return the checkout URL
 */
export async function createPaymobOrder(
  config: PaymobConfig,
): Promise<{ checkoutUrl: string; orderId: string }> {
  const { apiKey, integrationId, amountCents } = config;

  try {
    // Step 1: Authenticate
    const authRes = await axios.post('https://accept.paymob.com/api/auth/tokens', {
      api_key: apiKey,
    });
    const token = authRes.data?.token;
    if (!token) {
      throw new Error('Failed to get Paymob auth token');
    }

    // Step 2: Create order
    const orderRes = await axios.post(
      'https://accept.paymob.com/api/ecommerce/orders',
      {
        auth_token: token,
        delivery_needed: 'false',
        amount_cents: amountCents,
        currency: 'EGP',
        items: [],
      },
    );
    const orderId = orderRes.data?.id;
    if (!orderId) {
      throw new Error('Failed to create Paymob order');
    }

    // Step 3: Get payment key
    const payRes = await axios.post(
      'https://accept.paymob.com/api/acceptance/payment_keys',
      {
        auth_token: token,
        amount_cents: amountCents,
        currency: 'EGP',
        order_id: orderId,
        integration_id: integrationId,
        billing_data: {
          apartment: 'NA',
          email: 'user@example.com',
          floor: 'NA',
          first_name: 'User',
          street: 'NA',
          building: 'NA',
          phone_number: 'NA',
          shipping_method: 'NA',
          postal_code: 'NA',
          city: 'NA',
          country: 'EG',
          last_name: 'User',
          state: 'NA',
        },
      },
    );
    const paymentKey = payRes.data?.token;
    if (!paymentKey) {
      throw new Error('Failed to get Paymob payment key');
    }

    const checkoutUrl = `https://accept.paymob.com/api/acceptance/iframes/${integrationId}?payment_token=${paymentKey}`;
    return { checkoutUrl, orderId: orderId.toString() };
  } catch (error: any) {
    logger.error(
      'Paymob error',
      error?.response?.data || error?.message || error,
    );
    throw error;
  }
}

