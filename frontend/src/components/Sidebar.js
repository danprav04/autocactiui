import React from 'react';

const Sidebar = ({ 
  selectedNode, 
  neighbors, 
  onAddNeighbor, 
  onDownloadImage,
  availableIcons,
  currentIconName,
  setCurrentIconName,
  disabled 
}) => {
  return (
    <div className="sidebar">
      <h2>Controls</h2>
      <button onClick={onDownloadImage} disabled={disabled}>
        Download as PNG
      </button>
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