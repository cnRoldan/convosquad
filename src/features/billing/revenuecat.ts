import Purchases, { type PurchasesPackage } from 'react-native-purchases';
import { Platform } from 'react-native';
import { createPurchaseSession } from './purchase-session';

// Public SDK keys identify an app to RevenueCat; the private API and webhook
// credentials stay in RevenueCat/Supabase and are never bundled here.
const apiKey = Platform.OS === 'ios'
  ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
  : Platform.OS === 'android' ? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY : undefined;

const session = createPurchaseSession(apiKey, Purchases);

export function revenueCatReady() {
  return Platform.OS !== 'web' && Boolean(apiKey);
}

export async function configureRevenueCat(userId: string) {
  if (!revenueCatReady()) return false;
  return session.runAsUser(userId, async () => true);
}

export async function offeringPackage(userId: string, offeringIdentifier: string, packageIdentifier: '$rc_monthly' | '$rc_annual' | '$rc_lifetime'): Promise<PurchasesPackage | null> {
  if (!revenueCatReady()) return null;
  return session.runAsUser(userId, async () => {
    const offerings = await Purchases.getOfferings();
    const offering = offerings.all[offeringIdentifier] ?? (offeringIdentifier === 'premium' ? offerings.current : null);
    return offering?.availablePackages.find(item => item.identifier === packageIdentifier) ?? null;
  });
}

export async function purchaseRevenueCatPackage(userId: string, item: PurchasesPackage) {
  return session.runAsUser(userId, () => Purchases.purchasePackage(item));
}

export async function restoreRevenueCatPurchases(userId: string) {
  return session.runAsUser(userId, () => Purchases.restorePurchases());
}
