import mongoose, { Document, Schema } from 'mongoose';

export interface IAuditLog extends Document {
  admin?: mongoose.Types.ObjectId;
  action: string;
  targetType: string;
  targetId?: string;
  changes?: unknown;
  timestamp: Date;
}

const auditLogSchema = new Schema<IAuditLog>({
  admin: { type: Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true },
  targetType: { type: String, required: true },
  targetId: String,
  changes: Schema.Types.Mixed,
  timestamp: { type: Date, default: Date.now, index: true },
}, { minimize: false });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
