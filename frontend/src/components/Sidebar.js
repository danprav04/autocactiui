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
      <h2>Controls</h2>

      <div className="control-group">
        <label htmlFor="map-name-input">Map Name</label>
        <input
            id="map-name-input"
            type="text"
            value={mapName}
            onChange={(e) => setMapName(e.target.value)}
            disabled={disabled}
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
      <hr />

      {!disabled && (
        <div className="icon-selector-section">
            <h3>Device Icon</h3>
            <p>Select an icon for the next device you add.</p>
            <select 
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
      )}
      
      {selectedNode && <hr />}
      
      {selectedNode ? (
        <div className="neighbors-section">
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
        </div>
      ) : (
        !disabled && <p>Click a device on the map to see its neighbors.</p>
      )}
    </div>
  );
};

export default Sidebar;