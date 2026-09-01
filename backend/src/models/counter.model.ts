import { Schema, model, type Model } from 'mongoose';
import { currentBusinessId } from '../lib/tenantContext';

export interface ICounter {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<ICounter>(
  { _id: { type: String, required: true }, seq: { type: Number, default: 0 } },
  { versionKey: false },
);

export const Counter: Model<ICounter> = model<ICounter>('Counter', counterSchema);

/**
 * Atomic sequence for human-readable order numbers. findOneAndUpdate with
 * $inc is a single document write, so concurrent orders can't collide.
 *
 * The key is namespaced per franchise: each business numbers its own orders
 * from PO-00001, rather than continuing another business's sequence.
 */
export const nextSequence = async (key: string): Promise<number> => {
  const businessId = currentBusinessId();
  const scopedKey = businessId ? `${key}:${businessId}` : key;

  const doc = await Counter.findByIdAndUpdate(
    scopedKey,
    { $inc: { seq: 1 } },
    { returnDocument: 'after', upsert: true },
  );
  return doc!.seq;
};

export default Counter;
