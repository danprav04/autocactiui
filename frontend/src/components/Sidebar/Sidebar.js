// frontend/src/components/Sidebar/Sidebar.js
import React from 'react';
import { useTranslation } from 'react-i18next';
import MapExportControls from './MapExportControls';
import SidebarPlaceholder from './SidebarPlaceholder';
import MultiSelectToolbar from './MultiSelectToolbar';

const Sidebar = ({
  selectedElements,
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
  onDeleteElements,
  alignElements,
  distributeElements,
  bringForward,
  sendBackward,
  bringToFront,
  sendToBack,
}) => {
  const { t } = useTranslation();

  const handleResetClick = () => {
    if (window.confirm(t('sidebar.confirmReset'))) {
      onResetMap();
    }
  };

  const renderContextualContent = () => {
    const selectionCount = selectedElements.length;

    if (selectionCount > 1) {
      return (
        <MultiSelectToolbar
          selectedElements={selectedElements}
          alignElements={alignElements}
          distributeElements={distributeElements}
          bringForward={bringForward}
          sendBackward={sendBackward}
          bringToFront={bringToFront}
          sendToBack={sendToBack}
          onDeleteElements={onDeleteElements}
        />
      );
    }
    
    if (selectionCount === 1) {
      const selected = selectedElements[0];
      if (selected.type === 'custom') {
        return (
          <>
            <div className="selected-device-label">{selected.data.hostname}</div>
            <div className="control-group">
                <button onClick={onDeleteElements} className="danger">
                  {t('sidebar.deleteDevice')}
                </button>
            </div>
          </>
        );
      } else { // For Group or Text nodes
        return (
          <>
            <div className="selected-device-label">
              {selected.type === 'group' ? selected.data.label : t('sidebar.editText')}
            </div>
            <div className="control-group">
                <button onClick={onDeleteElements} className="danger">
                    {t('sidebar.deleteSelected')}
                </button>
            </div>
          </>
        );
      }
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