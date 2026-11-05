
import { getUserLocale } from '@/lib/utils/methods/locale';
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async () => {
  const locale = await getUserLocale();

  return {
    locale,
    messages: (await import(`../locales/${locale}.json`)).default,

    onError: (error) => {
      // Ignore missing translation messages.
      if (error.code !== 'MISSING_MESSAGE') {
        console.error('[i18n Error]:', error);
      }
    },

    getMessageFallback: ({ namespace, key }) =>
      namespace ? `${namespace}.${key}` : key,
  };
});
