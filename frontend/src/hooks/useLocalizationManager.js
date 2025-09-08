// frontend/src/hooks/useLocalizationManager.js
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export const useLocalizationManager = () => {
  const { i18n } = useTranslation();

  useEffect(() => {
    document.documentElement.lang = i18n.language;
    const dir = i18n.language === 'he' ? 'rtl' : 'ltr';
    document.documentElement.dir = dir;
  }, [i18n.language]);
};