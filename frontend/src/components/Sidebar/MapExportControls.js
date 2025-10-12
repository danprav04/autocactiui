// frontend/src/components/Sidebar/MapExportControls.js
import React from 'react';
import { useTranslation } from 'react-i18next';

const MapExportControls = ({
  mapName,
  setMapName,
  cactiGroups,
  selectedCactiGroupId,
  setSelectedCactiGroupId,
  onUploadMap,
  isUploading,
  isMapStarted,
}) => {
  const { t } = useTranslation();

  return (
    <div>
      <h2>{t('sidebar.controls')}</h2>
      <div className="control-group">
        <label htmlFor="map-name-input">{t('sidebar.mapName')}</label>
        <input
          id="map-name-input"
          type="text"
          value={mapName}
          onChange={(e) => setMapName(e.target.value)}
          disabled={!isMapStarted}
          placeholder={t('sidebar.mapNamePlaceholder')}
        />
      </div>
      <div className="control-group">
        <label htmlFor="cacti-selector">{t('sidebar.cactiInstall')}</label>
        <select
          id="cacti-selector"
          className="icon-selector"
          value={selectedCactiGroupId}
          onChange={(e) => setSelectedCactiGroupId(e.target.value)}
          disabled={!isMapStarted || cactiGroups.length === 0}
        >
          {cactiGroups.length === 0 ? (
            <option>{t('sidebar.cactiLoading')}</option>
          ) : (
            cactiGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))
          )}
        </select>
      </div>
      <div className="control-group">
        <button onClick={onUploadMap} disabled={!isMapStarted || isUploading || !selectedCactiGroupId}>
          {isUploading ? t('sidebar.uploading') : t('sidebar.uploadToCacti')}
        </button>
      </div>
    </div>
  );
};

export default MapExportControls;