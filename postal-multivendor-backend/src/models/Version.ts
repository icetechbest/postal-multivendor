import mongoose, { Document, Schema } from 'mongoose';

interface IAppVersion { android: string; ios: string }
export interface IVersion extends Document {
  key: string;
  customerAppVersion: IAppVersion;
  riderAppVersion: IAppVersion;
  restaurantAppVersion: IAppVersion;
}

const appVersion = { android: { type: String, default: '1.0.0' }, ios: { type: String, default: '1.0.0' } };
const versionSchema = new Schema<IVersion>({
  key: { type: String, unique: true, default: 'default' },
  customerAppVersion: { type: appVersion, default: () => ({ android: '1.0.0', ios: '1.0.0' }) },
  riderAppVersion: { type: appVersion, default: () => ({ android: '1.0.0', ios: '1.0.0' }) },
  restaurantAppVersion: { type: appVersion, default: () => ({ android: '1.0.0', ios: '1.0.0' }) },
}, { timestamps: true });

export const Version = mongoose.model<IVersion>('Version', versionSchema);
