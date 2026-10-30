import bcrypt from 'bcryptjs';
import { randomBytes, randomInt } from 'crypto';

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
};

export const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> =>
  bcrypt.compare(password, hashedPassword);

export const generateOTP = (length: number = 6): string => {
  let otp = '';
  for (let index = 0; index < length; index += 1) otp += randomInt(0, 10).toString();
  return otp;
};

export const generateOrderId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`.toUpperCase();
