import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import geoip from 'geoip-lite';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service.js';

type Region = 'EG' | 'INTL';

@Injectable()
export class PaymentsService {
  private stripe: Stripe | null = null;
  private logger = new Logger('PaymentsService');

  constructor(private prisma: PrismaService) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (key) {
      this.stripe = new Stripe(key, { apiVersion: '2024-11-20' as any });
    }
  }

  detectRegionFromIp(ip?: string): Region {
    if (!ip) return 'INTL';
    try {
      const lookup = geoip.lookup(ip);
      if (lookup?.country === 'EG') return 'EG';
    } catch {}
    return 'INTL';
  }

  async checkout(userId: number, dto: { courseId: number; enrollType: 'RECORDED' | 'ONLINE'; selectedStartDate?: string }, req: any) {
    const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
    if (!course) throw new BadRequestException('Course not found');
    const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
    const region = this.detectRegionFromIp(ip);
    const enrollType = dto.enrollType;
    const selectedStartDate = enrollType === 'ONLINE' ? (dto.selectedStartDate ? new Date(dto.selectedStartDate) : null) : null;
    if (enrollType === 'ONLINE' && !selectedStartDate) {
      throw new BadRequestException('selectedStartDate required for ONLINE');
    }
    // Determine price based on enrollment type + region
    let amount: number | null = null;
    if (enrollType === 'RECORDED') {
      amount = region === 'EG' ? (course as any).priceRecordedEgp : (course as any).priceRecordedUsd;
    } else {
      amount = region === 'EG' ? (course as any).priceOnlineEgp : (course as any).priceOnlineUsd;
    }
    if (typeof amount !== 'number' || amount <= 0) throw new BadRequestException('Price not configured');
    const currency = region === 'EG' ? 'EGP' : 'USD';
    const provider: 'stripe' | 'paymob' = region === 'EG' ? 'paymob' : 'stripe';

    // Create pending payment record
    const payment = await this.prisma.payment.create({
      data: {
        userId,
        courseId: course.id,
        enrollType,
        provider,
        status: 'pending',
        amount,
        currency,
        selectedStartDate: selectedStartDate ?? undefined,
      },
    });

    let checkoutUrl: string = '';
    let providerOrderId: string | null = null;

    if (provider === 'stripe') {
      if (!this.stripe) throw new BadRequestException('Stripe not configured');
      const priceIdEnv = enrollType === 'RECORDED' ? process.env.STRIPE_PRICE_ID_RECORDED_USD : process.env.STRIPE_PRICE_ID_ONLINE_USD;
      if (!priceIdEnv) throw new BadRequestException('Stripe price ID missing');
      const successBase = process.env.PAYMENT_SUCCESS_URL || 'https://example.com/payment-success';
      const cancelBase = process.env.PAYMENT_CANCEL_URL || 'https://example.com/payment-cancel';
      const session = await this.stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [ { price: priceIdEnv, quantity: 1 } ],
        success_url: `${successBase}?sessionId={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelBase,
        metadata: {
          paymentId: payment.id.toString(),
          courseId: course.id.toString(),
          enrollType,
          selectedStartDate: selectedStartDate?.toISOString() || '',
        },
      });
      checkoutUrl = session.url!;
      providerOrderId = session.id;
    } else {
      // Paymob integration (simplified)
      const apiKey = process.env.PAYMOB_API_KEY;
      const integrationId = process.env.PAYMOB_INTEGRATION_ID;
      const priceConfig = enrollType === 'RECORDED' ? process.env.PAYMOB_PRICE_EGP_RECORDED : process.env.PAYMOB_PRICE_EGP_ONLINE;
      if (!apiKey || !integrationId || !priceConfig) throw new BadRequestException('Paymob env vars missing');
      try {
        // Step 1: authenticate
        const authRes = await axios.post('https://accept.paymob.com/api/auth/tokens', { api_key: apiKey });
        const token = authRes.data?.token;
        // Step 2: create order with amount * 100 (cents)
        const amountCents = Math.round(amount * 100);
        const orderRes = await axios.post('https://accept.paymob.com/api/ecommerce/orders', {
          auth_token: token,
          delivery_needed: 'false',
          amount_cents: amountCents,
          currency: 'EGP',
          items: [],
        });
        const orderId = orderRes.data?.id;
        // Step 3: payment key
        const payRes = await axios.post('https://accept.paymob.com/api/acceptance/payment_keys', {
          auth_token: token,
          amount_cents: amountCents,
          currency: 'EGP',
          order_id: orderId,
          integration_id: integrationId,
          billing_data: {
            apartment: 'NA', email: 'user@example.com', floor: 'NA', first_name: 'User', street: 'NA', building: 'NA', phone_number: 'NA', shipping_method: 'NA', postal_code: 'NA', city: 'NA', country: 'EG', last_name: 'User', state: 'NA'
          },
        });
        const paymentKey = payRes.data?.token;
        checkoutUrl = `https://accept.paymob.com/api/acceptance/iframes/${integrationId}?payment_token=${paymentKey}`;
        providerOrderId = orderId?.toString() || null;
      } catch (e: any) {
        this.logger.error('Paymob error', e?.response?.data || e.message);
        throw new BadRequestException('Failed to create Paymob order');
      }
    }

    // Persist providerOrderId
    await this.prisma.payment.update({ where: { id: payment.id }, data: { providerOrderId } });
    return { checkoutUrl, paymentId: payment.id, providerOrderId };
  }

  async handleWebhook(provider: 'stripe' | 'paymob', rawBody: string, headers: any) {
    // Stripe signature validation
    if (provider === 'stripe') {
      if (!this.stripe) throw new BadRequestException('Stripe not configured');
      const sig = headers['stripe-signature'];
      const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!sig || !whSecret) throw new BadRequestException('Missing stripe signature');
      let event: Stripe.Event;
      try {
        event = this.stripe.webhooks.constructEvent(rawBody, sig, whSecret);
      } catch (e: any) {
        throw new BadRequestException('Invalid stripe webhook');
      }
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentIdStr = session.metadata?.paymentId;
        if (paymentIdStr) {
          const paymentId = Number(paymentIdStr);
          await this.markPaid(paymentId, session.id);
        }
      }
      return { ok: true };
    }
    // Paymob HMAC validation (simplified placeholder)
    if (provider === 'paymob') {
      // TODO: Implement real HMAC validation using PAYMOB_HMAC_SECRET
      this.logger.log('Received Paymob webhook');
      // Expect order id in body
      try {
        const body = JSON.parse(rawBody);
        const orderId = body?.obj?.order?.id || body?.order?.id || body?.id;
        if (orderId) {
          const p = await this.prisma.payment.findFirst({ where: { providerOrderId: orderId.toString(), provider: 'paymob' } });
          if (p && p.status !== 'paid') await this.markPaid(p.id, orderId.toString());
        }
      } catch {}
      return { ok: true };
    }
    throw new BadRequestException('Unknown provider');
  }

  private async markPaid(paymentId: number, providerOrderId: string) {
    const payment = await this.prisma.payment.update({ where: { id: paymentId }, data: { status: 'paid', providerOrderId } });
    // Create enrollment if not exists for this enrollType
    const existing = await this.prisma.enrollment.findFirst({ where: { userId: payment.userId, courseId: payment.courseId, enrollType: payment.enrollType } });
    if (!existing) {
      await this.prisma.enrollment.create({ data: {
        userId: payment.userId,
        courseId: payment.courseId,
        enrollType: payment.enrollType,
        selectedStartDate: payment.selectedStartDate ?? undefined,
        status: 'ACTIVE',
        currency: payment.currency,
        priceCents: Math.round(payment.amount * 100),
      } as any });
    }
  }

  async verify(query: { sessionId?: string; paymentId?: string }) {
    let payment: any = null;
    if (query.paymentId) {
      payment = await this.prisma.payment.findUnique({ where: { id: Number(query.paymentId) } });
    } else if (query.sessionId) {
      payment = await this.prisma.payment.findFirst({ where: { providerOrderId: query.sessionId } });
    }
    if (!payment) throw new BadRequestException('Payment not found');
    // If already paid, return enrollment info
    if (payment.status === 'paid') {
      const enrollment = await this.prisma.enrollment.findFirst({ where: { userId: payment.userId, courseId: payment.courseId, enrollType: payment.enrollType } });
      return { status: 'paid', enrollment };
    }
    // Attempt provider verification (Stripe only for now)
    if (payment.provider === 'stripe' && this.stripe && payment.providerOrderId) {
      try {
        const session = await this.stripe.checkout.sessions.retrieve(payment.providerOrderId);
        if (session.payment_status === 'paid') {
          await this.markPaid(payment.id, session.id);
          const enrollment = await this.prisma.enrollment.findFirst({ where: { userId: payment.userId, courseId: payment.courseId, enrollType: payment.enrollType } });
          return { status: 'paid', enrollment };
        }
      } catch {}
    }
    return { status: payment.status };
  }
}