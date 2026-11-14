'use client';

import { useCallback, useEffect, useState } from 'react';

type TPermission = 'default' | 'granted' | 'denied' | 'unsupported';

export const useBrowserNotifications = () => {
  const [permission, setPermission] = useState<TPermission>('default');

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission as TPermission);
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result as TPermission);
  }, []);

  const notify = useCallback((title: string, body: string) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    try {
      new Notification(title, { body, tag: `order-${title}-${body}` });
    } catch {
      // Some browsers require a service worker; ignore failures.
    }
  }, []);

  return { permission, requestPermission, notify };
};
