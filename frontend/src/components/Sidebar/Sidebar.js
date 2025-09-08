// frontend/src/components/Sidebar/Sidebar.js
import React from 'react';
import { useTranslation } from 'react-i18next';
import MapExportControls from './MapExportControls';
import DeviceEditor from './DeviceEditor';
import GroupEditor from './GroupEditor';
import SidebarPlaceholder from './SidebarPlaceholder';

const Sidebar = ({
  selectedElement,
  neighbors,
  onAddNeighbor,
  onDeleteNode,
  onUpdateNodeData,
  onUploadMap,
  onAddGroup,
  availableIcons,
  mapName,
  setMapName,
  isMapStarted,
  isUploading,
  cactiInstallations,
  selectedCactiId,
  setSelectedCactiId
}) => {
  const { t } = useTranslation();

  const renderEditor = () => {
    if (!selectedElement) {
      return <SidebarPlaceholder isMapStarted={isMapStarted} />;
    }
    
    switch (selectedElement.type) {
      case 'custom':
        return (
          <DeviceEditor
            selectedElement={selectedElement}
            onUpdateNodeData={onUpdateNodeData}
            onDeleteNode={onDeleteNode}
            availableIcons={availableIcons}
            neighbors={neighbors}
            onAddNeighbor={onAddNeighbor}
          />
        );
      case 'group':
        return (
          <GroupEditor
            selectedElement={selectedElement}
            onUpdateNodeData={onUpdateNodeData}
            onDeleteNode={onDeleteNode}
          />
        );
      default:
        return <SidebarPlaceholder isMapStarted={isMapStarted} />;
    }
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
            <button onClick={onAddGroup} className="secondary">{t('sidebar.addGroup')}</button>
          </div>
          <hr />
        </div>
      )}

      <div className="neighbors-section">
        {renderEditor()}
      </div>
    </div>
  );
};

export default Sidebar;