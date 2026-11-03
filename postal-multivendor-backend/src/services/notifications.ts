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

const whatsappConfigured = () => process.env.WHATSAPP_ENABLED === 'true' && Boolean(config.whatsapp.token && config.whatsapp.phoneNumberId && config.whatsapp.otpTemplate);

// WhatsApp wants digits only with the country code (no "+", no leading zeros).
const toWhatsAppNumber = (raw: string): string => {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = `${config.whatsapp.defaultCountryCode}${digits.slice(1)}`;
  return digits;
};

export const sendWhatsAppOtp = async (to: string, otp: string): Promise<void> => {
  const components: Record<string, unknown>[] = [{ type: 'body', parameters: [{ type: 'text', text: otp }] }];
  // Authentication templates with a copy-code / one-tap button also need the code in the button.
  if (config.whatsapp.otpButton) {
    components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: otp }] });
  }
  const response = await fetch(`https://graph.facebook.com/${config.whatsapp.apiVersion}/${config.whatsapp.phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.whatsapp.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: toWhatsAppNumber(to),
      type: 'template',
      template: { name: config.whatsapp.otpTemplate, language: { code: config.whatsapp.templateLanguage }, components },
    }),
  });
  if (!response.ok) throw new Error(`WhatsApp API ${response.status}: ${await response.text()}`);
};

/**
 * Sends a verification code to a phone number: WhatsApp first (cheap), Twilio SMS as fallback.
 * Throws only when a configured channel failed and there is nothing left to try.
 */
export const sendOtpMessage = async (to: string, otp: string, expiryMinutes: number): Promise<void> => {
  const body = `Your verification code is ${otp}. It expires in ${expiryMinutes} minutes.`;
  if (whatsappConfigured()) {
    try {
      await sendWhatsAppOtp(to, otp);
      return;
    } catch (error) {
      console.error('WhatsApp OTP delivery failed:', error instanceof Error ? error.message : error);
      if (!smsConfigured()) throw new Error('Could not send the verification code. Please try again later');
    }
  }
  await sendSms(to, body);
};
