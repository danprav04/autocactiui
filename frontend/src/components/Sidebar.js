import React from 'react';

const Sidebar = ({ 
  selectedNode, 
  neighbors, 
  onAddNeighbor, 
  onDownloadImage,
  onDownloadConfig,
  availableIcons,
  currentIconName,
  setCurrentIconName,
  mapName,
  setMapName,
  disabled 
}) => {
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
          <button onClick={onDownloadImage} disabled={disabled}>
            Download Map (.png)
          </button>
          <button onClick={onDownloadConfig} disabled={disabled} className="secondary">
            Download Config (.conf)
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
                <h3>Device Settings</h3>
                <label htmlFor="icon-selector">Icon for New Devices</label>
                <select 
                    id="icon-selector"
                    className="icon-selector"
                    value={currentIconName} 
                    onChange={(e) => setCurrentIconName(e.target.value)}
                >
                    {availableIcons.map(iconName => (
                        <option key={iconName} value={iconName}>
                            {iconName}
                        </option>
                    ))}
                </select>
            </div>
            
            <hr />
            
            <div className="neighbors-section">
                {selectedNode ? (
                    <>
                        <h3>Neighbors for:</h3>
                        <p className="selected-device-label">{selectedNode.data.hostname}</p>
                        {neighbors.length > 0 ? (
                            <ul>
                            {neighbors.map(neighbor => (
                                <li key={neighbor.ip}>
                                <span>
                                    {neighbor.hostname}
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