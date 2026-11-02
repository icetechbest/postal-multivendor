import config from '../config';
import { Configuration } from '../models/Configuration';
import { Taxation } from '../models/Taxation';
import { Tipping } from '../models/Tipping';
import { User } from '../models/User';
import { Version } from '../models/Version';
import { comparePassword, hashPassword } from '../utils/crypto';

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
    mapTileUrl: process.env.MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    geocodingUrl: process.env.GEOCODING_URL || 'https://nominatim.openstreetmap.org',
    routingUrl: process.env.ROUTING_URL || 'https://router.project-osrm.org',
    customerAppSentryUrl: config.sentry.dsn,
    termsAndConditions: process.env.TERMS_AND_CONDITIONS_URL || '',
    privacyPolicy: process.env.PRIVACY_POLICY_URL || '',
    testOtp: process.env.TEST_OTP || '',
    skipMobileVerification: boolEnv('SKIP_MOBILE_VERIFICATION', boolEnv('SKIP_PHONE_VERIFICATION', true)),
    skipEmailVerification: boolEnv('SKIP_EMAIL_VERIFICATION', true),
    costType: process.env.COST_TYPE || 'fixed',
    isPaidVersion: boolEnv('IS_PAID_VERSION', false),
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
  // The admin account is env-driven: ADMIN_EMAIL / ADMIN_PASSWORD.
  // - If it does not exist, create it.
  // - If it exists and an explicit password was supplied in the environment,
  //   re-hash and store it so changing the Railway variable actually takes
  //   effect on the next deploy instead of silently keeping the old password.
  //   Set ADMIN_SYNC_PASSWORD=false to opt out (e.g. if the password is
  //   managed from the dashboard only).
  const adminEmail = config.admin.email.toLowerCase();
  const explicitPassword = process.env.ADMIN_PASSWORD || process.env.ADMIN_PASS;
  const syncPassword = boolEnv('ADMIN_SYNC_PASSWORD', Boolean(explicitPassword));
  const existingAdmin = await User.findOne({ email: adminEmail }).select('+password');

  if (!existingAdmin) {
    await User.create({
      name: 'Postal Admin',
      email: adminEmail,
      password: await hashPassword(config.admin.password),
      role: 'ADMIN',
      emailVerified: true,
      emailIsVerified: true,
    });
  } else if (syncPassword && explicitPassword) {
    const matches = existingAdmin.password
      ? await comparePassword(explicitPassword, existingAdmin.password)
      : false;
    if (!matches) {
      existingAdmin.password = await hashPassword(explicitPassword);
      existingAdmin.role = existingAdmin.role === 'STAFF' ? 'STAFF' : 'ADMIN';
      existingAdmin.isActive = true;
      existingAdmin.refreshTokenHash = undefined;
      await existingAdmin.save();
      console.log(`🔑 Admin password synchronised from environment for ${adminEmail}`);
    }
  }
  if (config.env === 'production' && config.admin.password === 'admin123') {
    console.warn('WARNING: ADMIN_PASSWORD is using the default value. Set a strong password in the environment.');
  }
};
