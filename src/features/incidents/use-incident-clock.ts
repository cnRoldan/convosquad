import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

// Update at the next expiry, including after resuming the app, without polling the field.
export function useIncidentClock(incidents: readonly { expires_at: string }[]) {
  const [now, setNow] = useState(Date.now);
  const expiryKey = incidents.map(incident => Date.parse(incident.expires_at)).join(',');
  useEffect(() => {
    const timer = setTimeout(() => setNow(Date.now()), 0);
    return () => clearTimeout(timer);
  }, [expiryKey]);
  useEffect(() => {
    const current = Date.now();
    const next = Math.min(...expiryKey.split(',').map(Number).filter(time => time > current));
    const timer = Number.isFinite(next) ? setTimeout(() => setNow(Date.now()), Math.min(next - current + 1, 2147483647)) : undefined;
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') setNow(Date.now()); });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [expiryKey, now]);
  return now;
}
