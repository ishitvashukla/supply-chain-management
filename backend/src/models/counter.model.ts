import { Schema, model, type Model } from 'mongoose';

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
 */
export const nextSequence = async (key: string): Promise<number> => {
  const doc = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { returnDocument: 'after', upsert: true },
  );
  return doc!.seq;
};

export default Counter;
