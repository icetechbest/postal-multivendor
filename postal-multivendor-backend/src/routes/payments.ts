import express, { NextFunction, Request, Response } from 'express';
import Stripe from 'stripe';
import { Configuration } from '../models/Configuration';
import { Order } from '../models/Order';
import { publishOrderUpdate } from '../graphql/resolvers/appHelpers';
import config from '../config';

const paypal: any = require('paypal-rest-sdk');

export const paymentRoutes = express.Router();

const findOrder = async (id: string) => {
  const query = /^[a-f\d]{24}$/i.test(id) ? { $or: [{ orderId: id }, { _id: id }] } : { orderId: id };
  const order = await Order.findOne(query);
  if (!order) throw new Error('Order not found');
  return order;
};

const baseUrl = (req: Request): string => {
  const configured = process.env.SERVER_URL;
  if (configured) return configured.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`.replace(/\/$/, '');
};

const html = (title: string, message: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title></head><body><main><h1>${title}</h1><p>${message}</p><p>You can return to the Postal app.</p></main></body></html>`;

const markPaid = async (orderId: string, paymentId: string) => {
  const order = await findOrder(orderId);
  if (order.paymentStatus !== 'PAID') {
    order.paymentStatus = 'PAID';
    order.paidAmount = order.total;
    order.set('paymentReference', paymentId);
    await order.save();
    await publishOrderUpdate(order._id, 'payment');
  }
  return order;
};

paymentRoutes.get('/stripe/create-checkout-session', async (req, res, next) => {
  try {
    if (!config.stripe.secretKey) return res.status(503).send(html('Stripe unavailable', 'Stripe is not configured on the server.'));
    const order = await findOrder(String(req.query.id || ''));
    const configuration = await Configuration.findOne({ key: 'default' });
    const stripe = new Stripe(config.stripe.secretKey);
    const origin = baseUrl(req);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: `${origin}/stripe/success?id=${encodeURIComponent(order.orderId)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/stripe/cancel?id=${encodeURIComponent(order.orderId)}`,
      client_reference_id: order.orderId,
      metadata: { orderId: order.orderId },
      line_items: [{
        quantity: 1,
        price_data: {
          currency: String(configuration?.get('currency') || 'USD').toLowerCase(),
          unit_amount: Math.round(order.total * 100),
          product_data: { name: `Postal order ${order.orderId}` },
        },
      }],
    });
    if (!session.url) throw new Error('Stripe did not return a checkout URL');
    return res.redirect(session.url);
  } catch (error) {
    return next(error);
  }
});

paymentRoutes.get('/stripe/success', async (req, res, next) => {
  try {
    const orderId = String(req.query.id || '');
    if (req.query.session_id && config.stripe.secretKey) {
      const stripe = new Stripe(config.stripe.secretKey);
      const session = await stripe.checkout.sessions.retrieve(String(req.query.session_id));
      if (session.payment_status === 'paid' && session.metadata?.orderId === orderId) await markPaid(orderId, session.id);
    }
    return res.send(html('Payment successful', 'Your Stripe payment was completed.'));
  } catch (error) {
    return next(error);
  }
});

paymentRoutes.get('/stripe/cancel', (_req, res) => res.send(html('Payment cancelled', 'Your Stripe payment was cancelled.')));

paymentRoutes.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!config.stripe.secretKey || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).json({ error: 'Stripe webhook is not configured' });
  try {
    const stripe = new Stripe(config.stripe.secretKey);
    const signature = req.headers['stripe-signature'];
    if (!signature) return res.status(400).json({ error: 'Missing Stripe signature' });
    const event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.payment_status === 'paid' && session.metadata?.orderId) await markPaid(session.metadata.orderId, session.id);
    }
    return res.json({ received: true });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid webhook' });
  }
});

paymentRoutes.get('/paypal', async (req, res, next) => {
  try {
    if (!config.paypal.clientId || !config.paypal.clientSecret) return res.status(503).send(html('PayPal unavailable', 'PayPal is not configured on the server.'));
    const order = await findOrder(String(req.query.id || ''));
    const configuration = await Configuration.findOne({ key: 'default' });
    paypal.configure({ mode: config.paypal.mode, client_id: config.paypal.clientId, client_secret: config.paypal.clientSecret });
    const origin = baseUrl(req);
    const payment = {
      intent: 'sale',
      payer: { payment_method: 'paypal' },
      redirect_urls: {
        return_url: `${origin}/paypal/success?id=${encodeURIComponent(order.orderId)}`,
        cancel_url: `${origin}/paypal/cancel?id=${encodeURIComponent(order.orderId)}`,
      },
      transactions: [{
        amount: { total: order.total.toFixed(2), currency: String(configuration?.get('currency') || 'USD').toUpperCase() },
        description: `Postal order ${order.orderId}`,
        custom: order.orderId,
      }],
    };
    const created = await new Promise<any>((resolve, reject) => {
      paypal.payment.create(payment, (error: Error | null, result: unknown) => error ? reject(error) : resolve(result));
    });
    const approval = created.links?.find((link: any) => link.rel === 'approval_url')?.href;
    if (!approval) throw new Error('PayPal did not return an approval URL');
    return res.redirect(approval);
  } catch (error) {
    return next(error);
  }
});

paymentRoutes.get('/paypal/success', async (req, res, next) => {
  try {
    const orderId = String(req.query.id || '');
    const paymentId = String(req.query.paymentId || '');
    const payerId = String(req.query.PayerID || '');
    if (!paymentId || !payerId) throw new Error('Missing PayPal payment details');
    paypal.configure({ mode: config.paypal.mode, client_id: config.paypal.clientId, client_secret: config.paypal.clientSecret });
    await new Promise<any>((resolve, reject) => {
      paypal.payment.execute(paymentId, { payer_id: payerId }, (error: Error | null, result: unknown) => error ? reject(error) : resolve(result));
    });
    await markPaid(orderId, paymentId);
    return res.send(html('Payment successful', 'Your PayPal payment was completed.'));
  } catch (error) {
    return next(error);
  }
});

paymentRoutes.get('/paypal/cancel', (_req, res) => res.send(html('Payment cancelled', 'Your PayPal payment was cancelled.')));

paymentRoutes.get('/hyp/create-hyp-api-sign', (_req, res) =>
  res.status(501).json({ error: 'HYP payments are not implemented. Configure a supported HYP adapter before enabling this payment method.' })
);

paymentRoutes.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Payment route error:', error instanceof Error ? error.message : error);
  res.status(400).send(html('Payment error', error instanceof Error ? error.message : 'The payment could not be processed.'));
});
