// frontend/src/components/common/LanguageSwitcher.js
import React from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n'; // Directly import the initialized i18n instance

const LanguageSwitcher = () => {
  // useTranslation is still needed to make the component re-render on language change
  const { i18n: i18nFromHook } = useTranslation();

  const changeLanguage = (lng) => {
    // Call changeLanguage on the master instance
    i18n.changeLanguage(lng);
  };

  // Define supported languages here to avoid depending on t function for button labels
  const supportedLangs = {
      en: 'English',
      he: 'עברית'
  };

  return (
    <div className="language-switcher">
      <button onClick={() => changeLanguage('en')} disabled={i18nFromHook.language.startsWith('en')}>
        {supportedLangs.en}
      </button>
      <button onClick={() => changeLanguage('he')} disabled={i18nFromHook.language === 'he'}>
        {supportedLangs.he}
      </button>
    </div>
  );
};

export default LanguageSwitcher;