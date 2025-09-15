// frontend/src/components/Sidebar/Sidebar.js
import React from 'react';
import { useTranslation } from 'react-i18next';
import MapExportControls from './MapExportControls';
import NeighborsList from './NeighborsList';
import SidebarPlaceholder from './SidebarPlaceholder';

const Sidebar = ({
  selectedElements,
  neighbors,
  onAddNeighbor,
  onUploadMap,
  onAddGroup,
  onAddTextNode,
  onResetMap,
  onLogout,
  availableIcons,
  mapName,
  setMapName,
  isMapStarted,
  isUploading,
  cactiInstallations,
  selectedCactiId,
  setSelectedCactiId,
  selectAllByType,
}) => {
  const { t } = useTranslation();

  const handleResetClick = () => {
    if (window.confirm(t('sidebar.confirmReset'))) {
      onResetMap();
    }
  };

  const renderContextualContent = () => {
    if (selectedElements.length === 1 && selectedElements[0].type === 'custom') {
      return (
        <>
          <h3>{t('sidebar.availableNeighbors')}</h3>
          <NeighborsList neighbors={neighbors} onAddNeighbor={onAddNeighbor} />
        </>
      );
    }
    return <SidebarPlaceholder isMapStarted={isMapStarted} />;
  };

  return (
    <div className="sidebar">
      <MapExportControls
        mapName={mapName}
        setMapName={setMapName}
        cactiInstallations={cactiInstallations}
        selectedCactiId={selectedCactiId}
        setSelectedCactiId={setSelectedCactiId}
        onUploadMap={onUploadMap}
        isUploading={isUploading}
        isMapStarted={isMapStarted}
      />

      <hr />

      {isMapStarted && (
        <div>
          <h3>{t('sidebar.mapTools')}</h3>
           <div className="control-group">
              <label>{t('sidebar.addElements')}</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={onAddGroup} className="secondary">{t('sidebar.addGroup')}</button>
                <button onClick={onAddTextNode} className="secondary">{t('sidebar.addText')}</button>
              </div>
          </div>
           <div className="control-group">
              <label htmlFor="type-selector-all">{t('sidebar.quickSelect')}</label>
              <select
                id="type-selector-all"
                className="icon-selector"
                onChange={(e) => selectAllByType(e.target.value)}
                value=""
              >
                <option value="" disabled>{t('sidebar.selectByType')}</option>
                {availableIcons.map((iconName) => (
                  <option key={iconName} value={iconName}>
                    {iconName}
                  </option>
                ))}
              </select>
           </div>
          <div className="control-group">
            <label>{t('sidebar.mapActions')}</label>
            <button onClick={handleResetClick} className="danger" disabled={!isMapStarted}>
              {t('sidebar.clearMap')}
            </button>
          </div>
        </div>
      )}
      
      <h3>{t('sidebar.session')}</h3>
      <div className="control-group">
        <button onClick={onLogout} className="secondary">{t('sidebar.logout')}</button>
      </div>

      <hr />

      <div className="contextual-section">
        {renderContextualContent()}
      </div>
    </div>
  );
};

export default Sidebar;