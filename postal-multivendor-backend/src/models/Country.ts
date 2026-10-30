import mongoose, { Document, Schema } from 'mongoose';

export interface ICountry extends Document {
  iso: string;
  cities: Array<{ id: string; name: string; latitude: number; longitude: number }>;
}

const countrySchema = new Schema<ICountry>({
  iso: { type: String, required: true, unique: true, uppercase: true },
  cities: [{
    id: { type: String, required: true },
    name: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
  }],
}, { timestamps: true });

export const Country = mongoose.model<ICountry>('Country', countrySchema);
