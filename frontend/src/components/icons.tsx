/**
 * Every icon in the app, in one place.
 *
 * Solar "bold-duotone" throughout: the two tones are baked into the SVG as
 * differing fill-opacity on a single `currentColor`, so an icon picks up the
 * surrounding text colour and reads correctly in both themes without any
 * per-icon styling.
 *
 * Importing through this module (rather than `~icons/...` at each call site)
 * keeps the icon vocabulary consistent and makes a set swap a one-file change.
 */
import AddCircle from '~icons/solar/add-circle-bold-duotone';
import AltArrowDown from '~icons/solar/alt-arrow-down-bold-duotone';
import AltArrowLeft from '~icons/solar/alt-arrow-left-bold-duotone';
import AltArrowRight from '~icons/solar/alt-arrow-right-bold-duotone';
import ArrowLeft from '~icons/solar/arrow-left-bold-duotone';
import BillCheck from '~icons/solar/bill-check-bold-duotone';
import BillList from '~icons/solar/bill-list-bold-duotone';
import Box from '~icons/solar/box-bold-duotone';
import BoxMinimalistic from '~icons/solar/box-minimalistic-bold-duotone';
import Buildings from '~icons/solar/buildings-2-bold-duotone';
import Card from '~icons/solar/card-bold-duotone';
import CartLarge from '~icons/solar/cart-large-4-bold-duotone';
import ChartSquare from '~icons/solar/chart-square-bold-duotone';
import CheckCircle from '~icons/solar/check-circle-bold-duotone';
import ClipboardList from '~icons/solar/clipboard-list-bold-duotone';
import CloseCircle from '~icons/solar/close-circle-bold-duotone';
import DangerTriangle from '~icons/solar/danger-triangle-bold-duotone';
import Delivery from '~icons/solar/delivery-bold-duotone';
import FolderWithFiles from '~icons/solar/folder-with-files-bold-duotone';
import GraphUp from '~icons/solar/graph-up-bold-duotone';
import HamburgerMenu from '~icons/solar/hamburger-menu-bold-duotone';
import Inbox from '~icons/solar/inbox-bold-duotone';
import Layers from '~icons/solar/layers-bold-duotone';
import LockPassword from '~icons/solar/lock-password-bold-duotone';
import Logout from '~icons/solar/logout-2-bold-duotone';
import Magnifer from '~icons/solar/magnifer-bold-duotone';
import MenuDots from '~icons/solar/menu-dots-bold-duotone';
import MinusCircle from '~icons/solar/minus-circle-bold-duotone';
import Monitor from '~icons/solar/monitor-bold-duotone';
import Moon from '~icons/solar/moon-bold-duotone';
import PenNewSquare from '~icons/solar/pen-new-square-bold-duotone';
import Refresh from '~icons/solar/refresh-bold-duotone';
import RefreshCircle from '~icons/solar/refresh-circle-bold-duotone';
import Settings from '~icons/solar/settings-bold-duotone';
import Shop from '~icons/solar/shop-2-bold-duotone';
import Sun from '~icons/solar/sun-bold-duotone';
import TagPrice from '~icons/solar/tag-price-bold-duotone';
import TrashBin from '~icons/solar/trash-bin-trash-bold-duotone';
import UserCircle from '~icons/solar/user-circle-bold-duotone';
import UsersGroup from '~icons/solar/users-group-rounded-bold-duotone';
import WalletMoney from '~icons/solar/wallet-money-bold-duotone';
import Widget from '~icons/solar/widget-5-bold-duotone';

export const Icons = {
  // navigation
  dashboard: Widget,
  catalog: Layers,
  orders: ClipboardList,
  inventory: Box,
  payments: Card,
  expenses: BillList,
  analytics: ChartSquare,
  products: TagPrice,
  users: UsersGroup,
  settings: Settings,
  store: Shop,

  // chrome
  menu: HamburgerMenu,
  more: MenuDots,
  close: CloseCircle,
  search: Magnifer,
  logout: Logout,

  // theme
  sun: Sun,
  moon: Moon,
  system: Monitor,

  // direction
  chevronDown: AltArrowDown,
  chevronLeft: AltArrowLeft,
  chevronRight: AltArrowRight,
  back: ArrowLeft,

  // actions
  add: AddCircle,
  remove: MinusCircle,
  edit: PenNewSquare,
  trash: TrashBin,
  approve: CheckCircle,
  refresh: RefreshCircle,
  // Solar has no spinner in this weight; the plain refresh glyph is radially
  // symmetric, so it reads correctly under `animate-spin`.
  spinner: Refresh,

  // domain
  alert: DangerTriangle,
  deliver: Delivery,
  cart: CartLarge,
  receipt: BillCheck,
  wallet: WalletMoney,
  trend: GraphUp,
  package: BoxMinimalistic,
  folder: FolderWithFiles,
  empty: Inbox,
  lock: LockPassword,
  user: UserCircle,
  business: Buildings,
} as const;

export type IconName = keyof typeof Icons;
export type IconComponent = (typeof Icons)[IconName];
