import React, { useState, useEffect } from 'react';

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
        <h2>Controls</h2>
        <div className="control-group">
          <label htmlFor="map-name-input">Map Name</label>
          <input
              id="map-name-input"
              type="text"
              value={mapName}
              onChange={(e) => setMapName(e.target.value)}
              disabled={!isMapStarted}
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
            disabled={!isMapStarted || cactiInstallations.length === 0}
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
            disabled={!isMapStarted || isUploading || !selectedCactiId}
          >
            {isUploading ? 'Uploading...' : 'Upload to Cacti'}
          </button>
        </div>
      </div>
      
      <hr />

      {!isMapStarted ? (
        <div className="placeholder-message">
            Start by entering an IP address to begin mapping your network.
        </div>
      ) : (
        <div className="neighbors-section">
            {selectedNode ? (
                <>
                    <h3>Edit Device</h3>
                    <div className="control-group">
                      <label htmlFor="hostname-input">Hostname</label>
                      <input
                        id="hostname-input"
                        type="text"
                        value={editableHostname}
                        onChange={(e) => setEditableHostname(e.target.value)}
                      />
                    </div>

                    <div className="control-group">
                      <label htmlFor="ip-display">IP Address (Identifier)</label>
                      <input
                        id="ip-display"
                        type="text"
                        value={selectedNode.data.ip}
                        disabled={true} // IP is the unique ID and should not be changed
                      />
                    </div>
                    
                    <div className="control-group">
                      <label htmlFor="type-selector">Device Type</label>
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
                      <button onClick={handleUpdate}>Update Device</button>
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
                    Click a device on the map to see its details and neighbors.
                </div>
            )}
        </div>
      )}
    </div>
  );
};

export default Sidebar;