/** Paths on the turns backend, mirroring turns-dashboard's constants/endPoints.js. */
export const TURNS = {
  CHECK_BUSINESS: 'index.php/routeapi/api/check_valid_business_name',
  LOGIN: 'index.php/intapi/api/accounts/login',
  LOGOUT: 'index.php/intapi/mobileAuth/logOut',
  UPDATE_TOKEN: 'index.php/intapi/api/update_token',

  STORE_LIST: 'index.php/intapi/api/store_list',
  STORE_DETAILS: 'index.php/intapi/api/store_details',
  STORE_PRICE_LIST: 'index.php/intapi/api/stores_price_list',
  /** Price lists + their services and categories, for one store. */
  PRICE_LIST: 'index.php/intapi/api/price_list',
} as const;
