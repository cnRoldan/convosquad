import Purchases, { type PurchasesPackage } from 'react-native-purchases';
import { Platform } from 'react-native';

// Public SDK keys identify an app to RevenueCat; the private API and webhook
// credentials stay in RevenueCat/Supabase and are never bundled here.
const apiKey = Platform.OS === 'ios'
  ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
  : Platform.OS === 'android' ? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY : undefined;

let configuredFor: string | null = null;

export function revenueCatReady() {
  return Platform.OS !== 'web' && Boolean(apiKey);
}

export async function configureRevenueCat(userId: string) {
  if (!revenueCatReady() || configuredFor === userId || !apiKey) return false;
  Purchases.configure({ apiKey, appUserID: userId });
  configuredFor = userId;
  return true;
}

export async function premiumPackage(userId: string): Promise<PurchasesPackage | null> {
  if (!await configureRevenueCat(userId)) return null;
  return (await Purchases.getOfferings()).current?.availablePackages[0] ?? null;
}

export async function purchasePremium(userId: string, item: PurchasesPackage) {
  await configureRevenueCat(userId);
  return Purchases.purchasePackage(item);
}

export async function restorePremium(userId: string) {
  await configureRevenueCat(userId);
  return Purchases.restorePurchases();
}
