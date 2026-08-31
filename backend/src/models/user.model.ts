import bcrypt from 'bcryptjs';
import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';
import { ROLES, ROLE_VALUES, STORE_ROLES, type Role } from '../constants';
import ApiError from '../utils/ApiError';

export interface IUser {
  name: string;
  email: string;
  password: string;
  role: Role;
  /** Required for store-scoped roles; null for admins. */
  store?: Types.ObjectId | null;
  phone?: string;
  avatar?: string;
  isActive: boolean;
  lastLoginAt?: Date | null;
  /** Bumped on logout/revoke so outstanding refresh tokens stop working. */
  tokenVersion: number;
  /** Set when the account is linked to a turns login rather than a local one. */
  turnsUserId?: string | null;
  turnsRole?: string | null;
  businessId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserMethods {
  comparePassword(candidate: string): Promise<boolean>;
}

export type UserDocument = HydratedDocument<IUser, IUserMethods>;

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, minlength: 2 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Email is not valid'],
    },
    // `select: false` keeps the hash out of every query that doesn't ask for it.
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ROLE_VALUES, default: ROLES.STORE_STAFF, index: true },
    store: { type: Schema.Types.ObjectId, ref: 'Store', default: null, index: true },
    phone: { type: String, trim: true },
    avatar: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
    tokenVersion: { type: Number, default: 0 },
    turnsUserId: { type: String, default: null, index: true },
    turnsRole: { type: String, default: null },
    businessId: { type: String, default: null, index: true },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.password;
        return ret;
      },
    },
  },
);

// Mongoose 9 middleware takes no `next` callback — throw to abort instead.

/** A store-scoped user without a store could otherwise read every store's data. */
userSchema.pre('validate', function () {
  // Turns-linked accounts are scoped by their turns store, which may not have a
  // local Store document yet, so the local-store requirement doesn't apply.
  if (!this.turnsUserId && STORE_ROLES.includes(this.role) && !this.store) {
    throw ApiError.badRequest(`Users with role ${this.role} must belong to a store`);
  }
  if (this.role === ROLES.ADMIN) this.store = null;
});

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- mongoose's query-helper slot
type UserModel = Model<IUser, {}, IUserMethods>;

export const User = model<IUser, UserModel>('User', userSchema);
export default User;
