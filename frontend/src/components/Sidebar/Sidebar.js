// frontend/src/components/Sidebar/Sidebar.js
import React from 'react';
import { useTranslation } from 'react-i18next';
import MapExportControls from './MapExportControls';
import SidebarPlaceholder from './SidebarPlaceholder';
import MultiSelectToolbar from './MultiSelectToolbar';
import DeviceEditor from './DeviceEditor'; // Assuming DeviceEditor is available
import GroupEditor from './GroupEditor'; // Assuming GroupEditor is available
import TextEditor from './TextEditor'; // Assuming TextEditor is available
import NeighborsList from './NeighborsList';

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
  neighbors, // Neighbors for the currently selected node
  onAddNeighbor, // Function to add a neighbor (confirmNeighbor from hook)
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
      
      // Since the individual editors (Device, Group, Text) were missing, 
      // I will implement the logic directly using the available components for the missing part.
      
      if (selected.type === 'custom') {
        // This simulates the content of the DeviceEditor
        return (
          <>
            <div className="selected-device-label">{selected.data.hostname}</div>
            
            {/* The rest of DeviceEditor controls would go here. For now, just delete. */}
            <div className="control-group">
                <button onClick={onDeleteElements} className="danger">
                  {t('sidebar.deleteDevice')}
                </button>
            </div>
            
            <NeighborsList neighbors={neighbors} onAddNeighbor={onAddNeighbor} />
          </>
        );
      } else if (selected.type === 'group') {
        // This simulates the content of the GroupEditor. Since the actual GroupEditor.js is not provided, 
        // we keep the simplified structure which should be replaced by the full editor later.
        return (
          <>
            <div className="selected-device-label">{selected.data.label}</div>
            <div className="control-group">
                <button onClick={onDeleteElements} className="danger">
                    {t('sidebar.deleteGroup')}
                </button>
            </div>
          </>
        );
      } else if (selected.type === 'text') {
        // This simulates the content of the TextEditor.
        return (
          <>
            <div className="selected-device-label">{t('sidebar.editText')}</div>
            <div className="control-group">
                <button onClick={onDeleteElements} className="danger">
                    {t('sidebar.deleteText')}
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