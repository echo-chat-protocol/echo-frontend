import React, { createContext, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const { t, i18n } = useTranslation();

  const value = useMemo(() => ({
    t,
    i18n,
    language: i18n.language,
    setLanguage: (lang) => i18n.changeLanguage(lang),
  }), [t, i18n]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
