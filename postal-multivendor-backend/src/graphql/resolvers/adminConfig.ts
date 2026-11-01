import { Configuration } from '../../models/Configuration';
import { Version } from '../../models/Version';
import { AuthContext } from '../../middleware/auth';
import { audit, definedOnly, requireSuperAdmin } from './adminHelpers';

// Allow-lists keep each mutation from writing fields outside its own group.
const groups: Record<string, string[]> = {
  saveEmailConfiguration: ['email', 'password', 'emailName', 'enableEmail'],
  saveFormEmailConfiguration: ['formEmail'],
  saveSendGridConfiguration: ['sendGridApiKey', 'sendGridEnabled', 'sendGridEmail', 'sendGridEmailName', 'sendGridPassword'],
  saveFirebaseConfiguration: ['firebaseKey', 'authDomain', 'projectId', 'storageBucket', 'msgSenderId', 'appId', 'measurementId', 'vapidKey'],
  saveSentryConfiguration: ['dashboardSentryUrl', 'webSentryUrl', 'apiSentryUrl', 'customerAppSentryUrl', 'restaurantAppSentryUrl', 'riderAppSentryUrl'],
  saveGoogleApiKeyConfiguration: ['mapTileUrl', 'geocodingUrl', 'routingUrl'],
  saveCloudinaryConfiguration: ['cloudinaryUploadUrl', 'cloudinaryApiKey'],
  saveAmplitudeApiKeyConfiguration: ['webAmplitudeApiKey', 'appAmplitudeApiKey'],
  saveGoogleClientIDConfiguration: ['webClientID', 'androidClientID', 'iOSClientID', 'expoClientID'],
  saveWebConfiguration: ['mapTileUrl', 'geocodingUrl', 'routingUrl'],
  saveAppConfigurations: ['termsAndConditions', 'privacyPolicy', 'testOtp'],
  saveDeliveryRateConfiguration: ['deliveryRate', 'costType'],
  saveTwilioConfiguration: ['twilioAccountSid', 'twilioAuthToken', 'twilioPhoneNumber', 'twilioEnabled', 'twilioWhatsAppNumber'],
  saveVerificationsToggle: ['skipEmailVerification', 'skipMobileVerification', 'skipWhatsAppOTP'],
  saveCurrencyConfiguration: ['currency', 'currencySymbol'],
};

// Fields whose values are credentials: recorded as "changed" in the audit log, never with their value.
const secretFields = new Set(['password', 'twilioAuthToken', 'firebaseKey', 'sendGridApiKey', 'sendGridPassword', 'cloudinaryApiKey', 'testOtp']);

const saveGroup = (name: string) => async (_parent: unknown, { configurationInput }: { configurationInput: Record<string, unknown> }, context: AuthContext) => {
  requireSuperAdmin(context);
  const allowed = groups[name];
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(definedOnly(configurationInput))) {
    if (allowed.includes(key)) updates[key] = value;
  }
  const configuration = await Configuration.findOneAndUpdate(
    { key: 'default' },
    { $set: updates, $setOnInsert: { key: 'default' } },
    { new: true, upsert: true }
  );
  await audit(context, name, 'Configuration', configuration?._id, Object.keys(updates).map((key) => (secretFields.has(key) ? `${key}: [redacted]` : key)));
  return configuration;
};

const versionPart = (value?: { android?: string; ios?: string } | null) => definedOnly(value || {});

export const adminConfigResolvers = {
  Mutation: {
    ...Object.fromEntries(Object.keys(groups).map((name) => [name, saveGroup(name)])),
    setVersions: async (
      _parent: unknown,
      args: { customerAppVersion?: any; riderAppVersion?: any; restaurantAppVersion?: any },
      context: AuthContext
    ) => {
      requireSuperAdmin(context);
      const set: Record<string, string> = {};
      for (const key of ['customerAppVersion', 'riderAppVersion', 'restaurantAppVersion'] as const) {
        for (const [platform, value] of Object.entries(versionPart(args[key]))) {
          if (typeof value === 'string') set[`${key}.${platform}`] = value;
        }
      }
      await Version.findOneAndUpdate({ key: 'default' }, { $set: set, $setOnInsert: { key: 'default' } }, { upsert: true, new: true });
      await audit(context, 'setVersions', 'Version', undefined, set);
      return true;
    },
  },
};
