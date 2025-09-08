import React, { useState, useEffect } from 'react';

const Sidebar = ({ 
  selectedNode, 
  neighbors, 
  onAddNeighbor, 
  onDeleteNode,
  onUpdateNodeType,
  onUploadMap,
  availableIcons,
  initialIconName,
  setInitialIconName,
  mapName,
  setMapName,
  disabled,
  isUploading,
  cactiInstallations,
  selectedCactiId,
  setSelectedCactiId
}) => {
  const [assignedType, setAssignedType] = useState(availableIcons[0] || '');

  // When the selected node changes, if it's an 'Unknown' type,
  // reset the dropdown to the first available icon type.
  useEffect(() => {
    if (selectedNode && selectedNode.data.iconType === 'Unknown') {
      setAssignedType(availableIcons[0] || '');
    }
  }, [selectedNode, availableIcons]);

  const handleAssignType = () => {
    if (selectedNode && assignedType) {
      onUpdateNodeType(selectedNode.id, assignedType);
    }
  };

  return (
    <div className="sidebar">
      <div>
        <h2>Controls</h2>
        <div className="control-group">
          <label htmlFor="map-name-input">Map Name</label>
          <input
              id="map-name-input"
              type="text"
              value={mapName}
              onChange={(e) => setMapName(e.target.value)}
              disabled={disabled}
              placeholder="e.g., Core-Network"
          />
        </div>

        <div className="control-group">
          <label htmlFor="cacti-selector">Cacti Installation</label>
          <select
            id="cacti-selector"
            className="icon-selector"
            value={selectedCactiId}
            onChange={(e) => setSelectedCactiId(e.target.value)}
            disabled={disabled || cactiInstallations.length === 0}
          >
            {cactiInstallations.length === 0 ? (
              <option>Loading installations...</option>
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
            disabled={disabled || isUploading || !selectedCactiId}
          >
            {isUploading ? 'Uploading...' : 'Upload to Cacti'}
          </button>
        </div>
      </div>
      
      <hr />

      {disabled ? (
        <div className="placeholder-message">
            Start by entering an IP address to begin mapping your network.
        </div>
      ) : (
        <>
            <div className="icon-selector-section">
                <h3>Initial Device Settings</h3>
                <label htmlFor="icon-selector">Icon for First Device</label>
                <select 
                    id="icon-selector"
                    className="icon-selector"
                    value={initialIconName} 
                    onChange={(e) => setInitialIconName(e.target.value)}
                >
                    {availableIcons.map(iconName => (
                        <option key={iconName} value={iconName}>
                            {iconName}
                        </option>
                    ))}
                </select>
                <p>This icon is used for the first device you add to the map.</p>
            </div>
            
            <hr />
            
            <div className="neighbors-section">
                {selectedNode ? (
                    <>
                        <h3>Device Actions</h3>
                        <p className="selected-device-label">{selectedNode.data.hostname}</p>

                        {selectedNode.data.iconType === 'Unknown' && (
                          <div className="control-group">
                            <label htmlFor="type-assign-selector">Assign Device Type</label>
                            <select
                              id="type-assign-selector"
                              className="icon-selector"
                              value={assignedType}
                              onChange={(e) => setAssignedType(e.target.value)}
                            >
                              {availableIcons.map(iconName => (
                                <option key={iconName} value={iconName}>
                                  {iconName}
                                </option>
                              ))}
                            </select>
                            <button onClick={handleAssignType} style={{marginTop: '10px'}}>Update Type</button>
                          </div>
                        )}
                        
                        <div className="control-group">
                          <button onClick={onDeleteNode} className="danger">
                            Delete Device
                          </button>
                        </div>
                        
                        <h3>Available Neighbors</h3>
                        {neighbors.length > 0 ? (
                            <ul>
                            {neighbors.map(neighbor => (
                                <li key={neighbor.ip}>
                                <span>
                                    {neighbor.neighbor}
                                    <br/>
                                    <small>{neighbor.ip}</small>
                                </span>
                                <button onClick={() => onAddNeighbor(neighbor)}>Add</button>
                                </li>
                            ))}
                            </ul>
                        ) : (
                            <p className="no-neighbors-message">No new neighbors to add.</p>
                        )}
                    </>
                ) : (
                    <div className="placeholder-message">
                        Click a device on the map to see its available neighbors.
                    </div>
                )}
            </div>
        </>
      )}
    </div>
  );
};

export default Sidebar;