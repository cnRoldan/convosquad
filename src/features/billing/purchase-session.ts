type StoreSdk = {
  configure(options: { apiKey: string; appUserID: string }): void;
  logIn(userId: string): Promise<unknown>;
};

// Keep account changes and store operations in one queue: a second account
// cannot change the purchaser while a native purchase is still pending.
export function createPurchaseSession(apiKey: string | undefined, sdk: StoreSdk) {
  let configuredFor: string | null = null;
  let pending: Promise<unknown> = Promise.resolve();
  return {
    runAsUser<T>(userId: string, operation: () => Promise<T>): Promise<T> {
      const result = pending.then(async () => {
        if (!apiKey || !userId) throw new Error('Store configuration or purchaser is missing');
        if (configuredFor === null) sdk.configure({ apiKey, appUserID: userId });
        else if (configuredFor !== userId) await sdk.logIn(userId);
        configuredFor = userId;
        return operation();
      });
      // Cancellation or a failed store call must not block the next attempt.
      pending = result.then(() => undefined, () => undefined);
      return result;
    },
  };
}
