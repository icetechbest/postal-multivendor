import config from '../config';
import { Configuration } from '../models/Configuration';
import { Taxation } from '../models/Taxation';
import { Tipping } from '../models/Tipping';
import { User } from '../models/User';
import { Version } from '../models/Version';
import { hashPassword } from '../utils/crypto';

const boolEnv = (name: string, fallback: boolean): boolean => {
  const value = process.env[name];
  return value === undefined ? fallback : value.toLowerCase() === 'true';
};

export const bootstrapDatabase = async (): Promise<void> => {
  const configurationDefaults = {
    email: config.email.user,
    password: config.email.password,
    emailName: 'Postal',
    enableEmail: boolEnv('EMAIL_ENABLED', Boolean(config.email.user && config.email.password)),
    clientId: config.paypal.clientId,
    clientSecret: config.paypal.clientSecret,
    sandbox: config.paypal.mode !== 'live',
    publishableKey: config.stripe.publishableKey,
    secretKey: config.stripe.secretKey,
    currency: process.env.CURRENCY || 'USD',
    currencySymbol: process.env.CURRENCY_SYMBOL || '$',
    deliveryRate: config.delivery.defaultFee,
    twilioEnabled: boolEnv('TWILIO_ENABLED', Boolean(config.twilio.accountSid && config.twilio.authToken)),
    twilioAccountSid: config.twilio.accountSid,
    twilioAuthToken: config.twilio.authToken,
    twilioPhoneNumber: config.twilio.phoneNumber,
    firebaseKey: process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    projectId: config.firebase.projectId,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    msgSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.FIREBASE_APP_ID || '',
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || '',
    androidClientID: process.env.ANDROID_CLIENT_ID || '',
    iOSClientID: process.env.IOS_CLIENT_ID || '',
    expoClientID: process.env.EXPO_CLIENT_ID || '',
    appAmplitudeApiKey: config.amplitude.apiKey,
    googleApiKey: config.google.mapsApiKey,
    googlePlacesApiBaseUrl: process.env.GOOGLE_PLACES_API_BASE_URL || '',
    customerAppSentryUrl: config.sentry.dsn,
    termsAndConditions: process.env.TERMS_AND_CONDITIONS_URL || '',
    privacyPolicy: process.env.PRIVACY_POLICY_URL || '',
    testOtp: process.env.TEST_OTP || '',
    skipMobileVerification: boolEnv('SKIP_MOBILE_VERIFICATION', boolEnv('SKIP_PHONE_VERIFICATION', true)),
    skipEmailVerification: boolEnv('SKIP_EMAIL_VERIFICATION', true),
    costType: process.env.COST_TYPE || 'fixed',
    isPaidVersion: boolEnv('IS_PAID_VERSION', false),
    googleMapLibraries: process.env.GOOGLE_MAP_LIBRARIES || 'places,geometry',
    googleColor: process.env.GOOGLE_COLOR || '#0f766e',
    appleStoreUrl: process.env.APPLE_STORE_URL || '',
    playStoreUrl: process.env.PLAY_STORE_URL || '',
  };
  await Configuration.findOneAndUpdate(
    { key: 'default' },
    { $setOnInsert: { key: 'default', ...configurationDefaults } },
    { upsert: true, new: true }
  );
  await Version.findOneAndUpdate(
    { key: 'default' },
    {
      $setOnInsert: {
        key: 'default',
        customerAppVersion: { android: process.env.CUSTOMER_APP_VERSION_ANDROID || '1.0.0', ios: process.env.CUSTOMER_APP_VERSION_IOS || '1.0.0' },
        riderAppVersion: { android: process.env.RIDER_APP_VERSION_ANDROID || '1.0.0', ios: process.env.RIDER_APP_VERSION_IOS || '1.0.0' },
        restaurantAppVersion: { android: process.env.RESTAURANT_APP_VERSION_ANDROID || '1.0.0', ios: process.env.RESTAURANT_APP_VERSION_IOS || '1.0.0' },
      },
    },
    { upsert: true }
  );
  if (!await Taxation.exists({})) await Taxation.create({ taxationCharges: config.delivery.taxRate, enabled: true });
  if (!await Tipping.exists({})) {
    await Tipping.create({
      tipVariations: (process.env.TIP_VARIATIONS || '5,10,15,20').split(',').map(Number).filter(Number.isFinite),
      enabled: process.env.TIPPING_ENABLED !== 'false',
    });
  }
  if (!await User.findOne({ email: config.admin.email.toLowerCase() })) {
    await User.create({
      name: 'Postal Admin',
      email: config.admin.email.toLowerCase(),
      password: await hashPassword(config.admin.password),
      role: 'ADMIN',
      emailVerified: true,
      emailIsVerified: true,
    });
  }
  if (config.env === 'production' && config.admin.password === 'admin123') {
    console.warn('WARNING: ADMIN_PASSWORD is using the default value. Set a strong password in the environment.');
  }
};
