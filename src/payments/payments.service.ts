import { Injectable } from '@nestjs/common';
import { envs } from 'src/config';
import Stripe from 'stripe';
import { PaymentSessionDto } from './dto/payment-session.dto';
import { Request, Response } from 'express';

@Injectable()
export class PaymentsService {
  private readonly stripe = new Stripe(envs.stripeSecretKey);

  async createPaymentSession(paymentSessionDto: PaymentSessionDto) {
    const { currency, items, orderId } = paymentSessionDto;

    const lineItems = items.map((item) => {
      return {
        price_data: {
          currency,
          product_data: {
            name: item.name,
          },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      };
    });

    const session = await this.stripe.checkout.sessions.create({
      payment_intent_data: {
        metadata: {
          orderId,
        },
      },
      line_items: lineItems,
      mode: 'payment',
      success_url: envs.stripeSuccessUrl,
      cancel_url: envs.stripeCancelUrl,
    });

    return session;
  }

  async stripeWebhook(req: Request, res: Response) {
    const signature = req.headers['stripe-signature'];

    let event: Stripe.Event;

    // const endpointSecret =
    //   'whsec_721abedc437b45c11e19c2dc8854dece7c46dcd83ca21d5fd8cf4f3f012018e2';
    const endpointSecret = envs.stripeEndpointSecret;
    try {
      event = this.stripe.webhooks.constructEvent(
        req['rawBody'],
        signature,
        endpointSecret,
      );
    } catch (err) {
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
    console.log('event', event);

    switch (event.type) {
      case 'charge.succeeded':
        const chargeSucceded = event.data.object as Stripe.Charge;
        console.log({ metadata: chargeSucceded.metadata });
        console.log('Charge succeded: ', chargeSucceded.metadata.orderId);
        // Fulfill the purchase...
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
    return res.status(200).json({ signature });
  }
}
