import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const Sidebar = ({ 
  selectedNode, 
  neighbors, 
  onAddNeighbor, 
  onDeleteNode,
  onUpdateNodeData,
  onUploadMap,
  availableIcons,
  mapName,
  setMapName,
  isMapStarted,
  isUploading,
  cactiInstallations,
  selectedCactiId,
  setSelectedCactiId
}) => {
  const [editableHostname, setEditableHostname] = useState('');
  const [editableType, setEditableType] = useState('');
  const { t } = useTranslation();

  // When the selected node changes, update the local state for the input fields.
  useEffect(() => {
    if (selectedNode) {
      setEditableHostname(selectedNode.data.hostname);
      // Ensure that if a node has an "Unknown" type, the dropdown still shows a valid, selectable type.
      const currentType = selectedNode.data.iconType;
      setEditableType(availableIcons.includes(currentType) ? currentType : availableIcons[0]);
    }
  }, [selectedNode, availableIcons]);

  const handleUpdate = () => {
    if (selectedNode) {
      onUpdateNodeData(selectedNode.id, {
        hostname: editableHostname,
        iconType: editableType
      });
    }
  };

  return (
    <div className="sidebar">
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
            value={selectedCactiId}
            onChange={(e) => setSelectedCactiId(e.target.value)}
            disabled={!isMapStarted || cactiInstallations.length === 0}
          >
            {cactiInstallations.length === 0 ? (
              <option>{t('sidebar.cactiLoading')}</option>
            ) : (
              cactiInstallations.map(inst => (
                <option key={inst.id} value={inst.id}>
                  {inst.hostname} ({inst.ip})
                </option>
              ))
            )}
          </select>
        </div>

        <div className="control-group">
          <button 
            onClick={onUploadMap} 
            disabled={!isMapStarted || isUploading || !selectedCactiId}
          >
            {isUploading ? t('sidebar.uploading') : t('sidebar.uploadToCacti')}
          </button>
        </div>
      </div>
      
      <hr />

      {!isMapStarted ? (
        <div className="placeholder-message">
            {t('sidebar.placeholderStart')}
        </div>
      ) : (
        <div className="neighbors-section">
            {selectedNode ? (
                <>
                    <h3>{t('sidebar.editDevice')}</h3>
                    <div className="control-group">
                      <label htmlFor="hostname-input">{t('sidebar.hostname')}</label>
                      <input
                        id="hostname-input"
                        type="text"
                        value={editableHostname}
                        onChange={(e) => setEditableHostname(e.target.value)}
                      />
                    </div>

                    <div className="control-group">
                      <label htmlFor="ip-display">{t('sidebar.ipAddress')}</label>
                      <input
                        id="ip-display"
                        type="text"
                        value={selectedNode.data.ip}
                        disabled={true} // IP is the unique ID and should not be changed
                      />
                    </div>
                    
                    <div className="control-group">
                      <label htmlFor="type-selector">{t('sidebar.deviceType')}</label>
                      <select
                        id="type-selector"
                        className="icon-selector"
                        value={editableType}
                        onChange={(e) => setEditableType(e.target.value)}
                      >
                        {availableIcons.map(iconName => (
                          <option key={iconName} value={iconName}>
                            {iconName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="control-group">
                      <button onClick={handleUpdate}>{t('sidebar.updateDevice')}</button>
                      <button onClick={onDeleteNode} className="danger">
                        {t('sidebar.deleteDevice')}
                      </button>
                    </div>
                    
                    <h3>{t('sidebar.availableNeighbors')}</h3>
                    {neighbors.length > 0 ? (
                        <ul>
                        {neighbors.map(neighbor => (
                            <li key={neighbor.ip}>
                            <span>
                                {neighbor.neighbor}
                                <br/>
                                <small>{neighbor.ip}</small>
                            </span>
                            <button onClick={() => onAddNeighbor(neighbor)}>{t('sidebar.add')}</button>
                            </li>
                        ))}
                        </ul>
                    ) : (
                        <p className="no-neighbors-message">{t('sidebar.noNeighbors')}</p>
                    )}
                </>
            ) : (
                <div className="placeholder-message">
                    {t('sidebar.placeholderClickNode')}
                </div>
            )}
        </div>
      )}
    </div>
  );
};

export default Sidebar;