import { EventAnalyticsModel, UserPropertyAnalyticsModel } from './models';

export const Events = {
  OUR_FIRST_OPEN: new EventAnalyticsModel('our_first_open', true),
  UI_VIEW_SHOW: new EventAnalyticsModel('ui_view_show'),
  UI_BUTTON_TAP: new EventAnalyticsModel('ui_button_tap'),
  APP_OPEN: new EventAnalyticsModel('app_open', true),
  APP_CLOSE: new EventAnalyticsModel('app_close', true),
  ERROR: new EventAnalyticsModel('error', true),
  ERROR_CORRECTED: new EventAnalyticsModel('error_corrected', true),
  APP_VERSION_UPDATE: new EventAnalyticsModel('app_version_update', true),
  OS_VERSION_UPDATE: new EventAnalyticsModel('os_version_update', true),
  ENGAGEMENT: new EventAnalyticsModel('engagement', true),
  ENGAGEMENT_PRIMARY: new EventAnalyticsModel('engagement_primary', true),
  ONBOARDING_ENTER: new EventAnalyticsModel('onboarding_enter', true),
  ONBOARDING_EXIT: new EventAnalyticsModel('onboarding_exit', true),
  ONBOARDING_QUESTIONNAIRE_ENTER: new EventAnalyticsModel(
    'onboarding_questionnaire_enter',
    true
  ),
  ONBOARDING_QUESTIONNAIRE_EXIT: new EventAnalyticsModel(
    'onboarding_questionnaire_exit',
    true
  ),
  ACCOUNT_SIGNUP_ENTER: new EventAnalyticsModel('account_signup_enter', true),
  ACCOUNT_SIGNUP_EXIT: new EventAnalyticsModel('account_signup_exit', true),
  PAYWALL_ENTER: new EventAnalyticsModel('paywall_show', true),
  PAYWALL_EXIT: new EventAnalyticsModel('paywall_exit', true),
  PAYWALL_PURCHASE_TAP: new EventAnalyticsModel('paywall_purchase_tap', true),
  SUBSCRIPTION_START_INTRO: new EventAnalyticsModel(
    'subscription_start_intro',
    true
  ),
  SUBSCRIPTION_START_PAID_REGULAR: new EventAnalyticsModel(
    'subscription_start_paid_regular',
    true
  ),
  SUBSCRIPTION_START_NEW: new EventAnalyticsModel(
    'subscription_start_new',
    true
  ),
  SUBSCRIPTION_RESTORE: new EventAnalyticsModel('subscription_restore', true),
  PURCHASE_NON_CONSUMABLE_ONE_TIME: new EventAnalyticsModel('purchase_non_consumable_one_time', true),
  PURCHASE_CONSUMABLE: new EventAnalyticsModel('purchase_consumable', true),
  PURCHASE_NEW: new EventAnalyticsModel('purchase_new', true),
  ATT_PROMPT_NOT_ALLOWED: new EventAnalyticsModel('att_prompt_not_allowed', true),
  ATT_PROMPT_SHOW: new EventAnalyticsModel('att_prompt_show', true),
  ATT_PROMPT_TAP_ALLOW: new EventAnalyticsModel('att_prompt_tap_allow', true),
  ATT_PROMPT_TAP_DENY: new EventAnalyticsModel('att_prompt_tap_deny', true),
} as const;

export const UserProperties = {
  ANALYTICS_VERSION: new UserPropertyAnalyticsModel('analytics_version', true),
  INSTALL_DATE: new UserPropertyAnalyticsModel('install_date', true),
  INSTALL_VERSION: new UserPropertyAnalyticsModel('install_version', true),
  INSTALL_OS_VERSION: new UserPropertyAnalyticsModel(
    'install_os_version',
    true
  ),
  INSTALL_IS_JAILBROKEN: new UserPropertyAnalyticsModel(
    'install_is_jailbroken',
    true
  ),
  INSTALL_UI_APPEARANCE: new UserPropertyAnalyticsModel(
    'install_ui_appearance',
    true
  ),
  INSTALL_DYNAMIC_TYPE: new UserPropertyAnalyticsModel(
    'install_dynamic_type',
    true
  ),
  APP_COLD_LAUNCH_COUNT: new UserPropertyAnalyticsModel(
    'app_cold_launch_count',
    true
  ),
  APP_OPEN_COUNT: new UserPropertyAnalyticsModel('app_open_count', true),
  LAST_VIEW_SHOW: new UserPropertyAnalyticsModel('last_view_show', true),
  SUBSCRIPTION_INTRO_OFFER: new UserPropertyAnalyticsModel(
    'subscription_intro_offer',
    true
  ),
  SUBSCRIPTION: new UserPropertyAnalyticsModel('subscription', true),
  SUBSCRIPTION2: new UserPropertyAnalyticsModel('subscription2', true),
} as const;

export const DEFAULT_INSTALL_USER_PROPERTIES: UserPropertyAnalyticsModel[] = [
  UserProperties.INSTALL_DATE,
  UserProperties.INSTALL_VERSION,
  UserProperties.INSTALL_OS_VERSION,
  UserProperties.INSTALL_IS_JAILBROKEN,
  UserProperties.INSTALL_UI_APPEARANCE,
  UserProperties.INSTALL_DYNAMIC_TYPE,
];
