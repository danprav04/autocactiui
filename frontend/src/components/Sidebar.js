import React from 'react';

const Sidebar = ({ selectedNode, neighbors, onAddNeighbor, onGenerateMap, disabled }) => {
  return (
    <div className="sidebar">
      <h2>Controls</h2>
      <button onClick={onGenerateMap} disabled={disabled}>
        Generate Final Map
      </button>
      <hr />
      
      {selectedNode ? (
        <div className="neighbors-section">
            <h3>Neighbors for:</h3>
            <p className="selected-device-label">{selectedNode.data.label.replace('\n', ' ')}</p>
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
        <p>Click a device on the map to see its neighbors.</p>
      )}

    </div>
  );
};

export default Sidebar;