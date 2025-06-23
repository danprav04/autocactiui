import React from 'react';

const Sidebar = ({ 
  selectedNode, 
  neighbors, 
  onAddNeighbor, 
  onDownloadImage,
  availableIcons,
  currentIcon,
  setCurrentIcon,
  disabled 
}) => {
  return (
    <div className="sidebar">
      <h2>Controls</h2>
      <button onClick={onDownloadImage} disabled={disabled}>
        Download as PNG
      </button>
      <hr />

      {/* New Icon Selector section */}
      {!disabled && (
        <div className="icon-selector-section">
            <h3>Device Icon</h3>
            <p>Select an icon for the next device you add.</p>
            <select 
                className="icon-selector"
                value={currentIcon} 
                onChange={(e) => setCurrentIcon(e.target.value)}
            >
                {availableIcons.map(iconFile => (
                    <option key={iconFile} value={iconFile}>
                        {iconFile.split('.')[0]} {/* Show filename without extension */}
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