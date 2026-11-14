import express, { NextFunction, Request, Response } from 'express';

export const paymentRoutes = express.Router();

const html = (title: string, message: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title></head><body><main><h1>${title}</h1><p>${message}</p></main></body></html>`;

paymentRoutes.get('/hyp/create-hyp-api-sign', (_req, res) =>
  res.status(501).json({ error: 'HYP payments are not implemented. Configure a supported HYP adapter before enabling this payment method.' })
);

paymentRoutes.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Payment route error:', error instanceof Error ? error.message : error);
  res.status(400).send(html('Payment error', error instanceof Error ? error.message : 'The payment could not be processed.'));
});
