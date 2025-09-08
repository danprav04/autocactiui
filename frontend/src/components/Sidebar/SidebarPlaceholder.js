// frontend/src/components/Sidebar/SidebarPlaceholder.js
import React from 'react';
import { useTranslation } from 'react-i18next';

const SidebarPlaceholder = ({ isMapStarted }) => {
  const { t } = useTranslation();
  const message = isMapStarted ? t('sidebar.placeholderClickNode') : t('sidebar.placeholderStart');
  
  return (
    <div className="placeholder-message">
      {message}
    </div>
  );
};

export default SidebarPlaceholder;