import mongoose from 'mongoose';

const positive = { type: Number, required: true, min: Number.MIN_VALUE,
  validate: { validator: Number.isFinite, message: 'Must be finite' } };
const count = { ...positive, min: 1,
  validate: { validator: Number.isSafeInteger, message: 'Must be an integer' } };
const text = { type: String, required: true, trim: true, maxlength: 200 };

const pointSchema = new mongoose.Schema({
  type: { type: String, enum: ['Point'], default: 'Point', required: true },
  coordinates: {
    type: [Number], required: true,
    validate: { validator: (v) => v.length === 2 && v.every(Number.isFinite)
      && Math.abs(v[0]) <= 180 && Math.abs(v[1]) <= 90,
    message: 'Use [longitude, latitude] within valid geographic bounds' },
  },
}, { _id: false });

const propertySchema = new mongoose.Schema({
  title: { ...text, maxlength: 300 },
  sector: { ...text, index: true },
  property_type: { ...text, enum: ['flat', 'house'] },
  price_inr: positive,
  built_up_area: positive,
  bedRoom: count,
  bathroom: count,
  furnishing_type: { ...text, enum: ['furnished', 'semifurnished', 'unfurnished'] },
  luxury_category: { ...text, enum: ['Luxury', 'Premium', 'Standard'] },
  agePossession: { ...text, enum: ['Moderately Old', 'New Property', 'Old Property',
    'Relatively New', 'Under Construction'] },
  // Retain remaining inference features when a listing supplies them.
  balcony: { type: String, enum: ['0', '1', '2', '3', '3+'] },
  'servant room': { type: Number, enum: [0, 1] },
  'store room': { type: Number, enum: [0, 1] },
  floor_category: { type: String, enum: ['High-Rise', 'Low-Rise', 'Mid-Rise'] },
  image_url: { type: String, maxlength: 2048, validate: {
    validator: (value) => { try { return ['http:', 'https:'].includes(new URL(value).protocol); }
      catch { return false; } }, message: 'image_url must be an HTTP(S) URL',
  } },
  location_coordinates: { type: pointSchema, default: undefined },
}, { timestamps: true, strict: 'throw', bufferCommands: false });

propertySchema.index({ location_coordinates: '2dsphere' });
propertySchema.index({ sector: 1, price_inr: 1, bedRoom: 1 });

export default mongoose.model('Property', propertySchema);
