import type {
  AnalyticsAdaptor,
  AnalyticsAdaptorWithReadOnlyUserPseudoID,
  AnalyticsAdaptorWithReadWriteUserID,
  AnalyticsAdaptorWithWriteOnlyUserID,
  AnalyticsParams,
  AnalyticsParamsWithNil,
  TASubscriptionStartAnalytics,
} from './models';

export const isReadOnlyPseudoIDAdaptor = (
  adaptor: AnalyticsAdaptor
): adaptor is AnalyticsAdaptorWithReadOnlyUserPseudoID =>
  typeof (adaptor as any).getUserPseudoID === 'function';

export const isReadWriteUserIDAdaptor = (
  adaptor: AnalyticsAdaptor
): adaptor is AnalyticsAdaptorWithReadWriteUserID =>
  typeof (adaptor as any).getUserID === 'function' &&
  typeof (adaptor as any).setUserID === 'function';

export const isWriteOnlyUserIDAdaptor = (
  adaptor: AnalyticsAdaptor
): adaptor is AnalyticsAdaptorWithWriteOnlyUserID =>
  typeof (adaptor as any).setUserID === 'function';

/**
 * Drop undefined/null params while preserving the rest.
 */
export const filterNilParams = (
  params?: AnalyticsParamsWithNil
): AnalyticsParams => {
  if (!params) {
    return {};
  }
  return Object.entries(params).reduce<AnalyticsParams>((acc, [key, value]) => {
    if (value !== undefined && value !== null) {
      acc[key] = value;
    }
    return acc;
  }, {});
};

/**
 * Common subscription event parameters for paywall-related events.
 */
export const addSubscriptionParams = (
  params: AnalyticsParams,
  sub: TASubscriptionStartAnalytics
) => {
  params.product_id = sub.productID;
  params.type = sub.subscriptionType;
  params.placement = sub.paywall.analyticsPlacement;
  params.value = sub.price;
  params.price = sub.price;
  params.currency = sub.currency;
  params.quantity = 1;
  if (sub.paywall.anayticsID) {
    params.paywall_id = sub.paywall.anayticsID;
  }
  if (sub.paywall.analyticsName) {
    params.paywall_name = sub.paywall.analyticsName;
  }
};
