// frontend/src/components/Sidebar/Sidebar.js
import React, { useContext, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { NodeContext } from '../../App';
import MapExportControls from './MapExportControls';
import SidebarPlaceholder from './SidebarPlaceholder';
import MultiSelectToolbar from './MultiSelectToolbar';
import DeviceEditor from './DeviceEditor';
import GroupEditor from './GroupEditor';
import TextEditor from './TextEditor';

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
  cactiGroups,
  selectedCactiGroupId,
  setSelectedCactiGroupId,
  selectAllByType,
  onDeleteElements,
  alignElements,
  distributeElements,
  bringForward,
  sendBackward,
  bringToFront,
  sendToBack,
  neighbors,
  onAddNeighbor,
  onDownloadConfig,
  onImportConfig,
}) => {
  const { t } = useTranslation();
  const { onUpdateNodeData } = useContext(NodeContext);
  const importInputRef = useRef(null);

  const handleResetClick = () => {
    if (window.confirm(t('sidebar.confirmReset'))) {
      onResetMap();
    }
  };

  const handleImportClick = () => {
    importInputRef.current.click();
  };

  const handleFileImport = (event) => {
    const file = event.target.files[0];
    if (file) {
      onImportConfig(file);
    }
    // Reset the input value to allow importing the same file again
    event.target.value = null;
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
      
      switch (selected.type) {
        case 'custom':
          return (
            <DeviceEditor
              selectedElement={selected}
              onDeleteElements={onDeleteElements}
              neighbors={neighbors}
              onAddNeighbor={onAddNeighbor}
            />
          );
        case 'group':
          return (
            <GroupEditor
              selectedElement={selected}
              onUpdateNodeData={onUpdateNodeData}
              onDeleteElements={onDeleteElements}
            />
          );
        case 'text':
          return (
            <TextEditor
              selectedElement={selected}
              onUpdateNodeData={onUpdateNodeData}
              onDeleteElements={onDeleteElements}
            />
          );
        default:
          return <SidebarPlaceholder isMapStarted={isMapStarted} />;
      }
    }

    return <SidebarPlaceholder isMapStarted={isMapStarted} />;
  };

  return (
    <div className="sidebar">
      <MapExportControls
        mapName={mapName}
        setMapName={setMapName}
        cactiGroups={cactiGroups}
        selectedCactiGroupId={selectedCactiGroupId}
        setSelectedCactiGroupId={setSelectedCactiGroupId}
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
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <button onClick={onDownloadConfig} className="secondary" disabled={!isMapStarted}>
                    {t('sidebar.downloadMap')}
                </button>
                <input
                    type="file"
                    ref={importInputRef}
                    onChange={handleFileImport}
                    style={{ display: 'none' }}
                    accept=".json"
                />
                <button onClick={handleImportClick} className="secondary">
                    {t('sidebar.importMap')}
                </button>
            </div>
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