import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import type { CheckoutDto } from './dto/checkout.dto.js';
import { PaymentsService } from './payments.service.js';

@Controller('payments')
export class PaymentsController {
  constructor(private svc: PaymentsService) {}

  @Post('checkout')
  async checkout(@Body() body: CheckoutDto, @Req() req: Request & { user?: any }) {
    const userId = Number((req as any).user?.sub || (req as any).user?.id || 0);
    if (!userId) throw new Error('Auth required');
    return this.svc.checkout(userId, body, req);
  }

  @Post('webhook/stripe')
  async stripeWebhook(@Req() req: any) {
    const rawBody = req.rawBody || req.bodyRaw || req.body?.toString?.() || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    return this.svc.handleWebhook('stripe', rawBody, req.headers);
  }

  @Post('webhook/paymob')
  async paymobWebhook(@Req() req: any) {
    const rawBody = req.rawBody || req.bodyRaw || req.body?.toString?.() || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    return this.svc.handleWebhook('paymob', rawBody, req.headers);
  }

  @Get('verify')
  async verify(@Query('sessionId') sessionId?: string, @Query('paymentId') paymentId?: string) {
    return this.svc.verify({ sessionId, paymentId });
  }
}