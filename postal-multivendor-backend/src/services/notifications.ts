import nodemailer from 'nodemailer';
import twilio from 'twilio';
import config from '../config';

const emailConfigured = () => process.env.EMAIL_ENABLED === 'true' && Boolean(config.email.host && config.email.user && config.email.password);
const smsConfigured = () => process.env.TWILIO_ENABLED === 'true' && Boolean(config.twilio.accountSid && config.twilio.authToken && config.twilio.phoneNumber);

export const sendEmail = async (to: string, subject: string, text: string): Promise<void> => {
  if (!emailConfigured()) {
    if (config.env === 'production') console.warn(`Email delivery is disabled; message to ${to} was not sent`);
    else console.info(`[development email] to=${to} subject=${subject}\n${text}`);
    return;
  }
  const transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.port === 465,
    auth: { user: config.email.user, pass: config.email.password },
  });
  await transporter.sendMail({ from: config.email.from, to, subject, text });
};

export const sendSms = async (to: string, body: string): Promise<void> => {
  if (!smsConfigured()) {
    if (config.env === 'production') console.warn(`SMS delivery is disabled; message to ${to} was not sent`);
    else console.info(`[development sms] to=${to}\n${body}`);
    return;
  }
  await twilio(config.twilio.accountSid, config.twilio.authToken).messages.create({
    from: config.twilio.phoneNumber,
    to,
    body,
  });
};
