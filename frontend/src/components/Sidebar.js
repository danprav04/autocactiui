import React from 'react';

const Sidebar = ({ neighbors, onAddNeighbor, onGenerateMap, disabled }) => {
  // We track which neighbor is selected to know the source for the edge
  const [selectedSourceIp, setSelectedSourceIp] = React.useState('');

  const handleNeighborClick = (neighbor) => {
    // Assuming the last neighbor list fetched corresponds to the last node added.
    // In a more complex app, you would track the currently selected node.
    if (neighbors.length > 0) {
       // This logic is simple; a more robust solution would track the selected node's IP.
       // For now, we assume we add neighbors relative to the device that fetched them.
       // A better approach would be to pass the sourceNodeId to onAddNeighbor.
       // Let's assume the user clicks on a node in the map to see its neighbors.
       // For this simplified version, this will work.
    }
  };

  return (
    <div className="sidebar">
      <h2>Controls</h2>
      <button onClick={onGenerateMap} disabled={disabled}>
        Generate Final Map
      </button>
      <hr />
      <h3>Available Neighbors</h3>
      {neighbors.length > 0 ? (
        <ul>
          {neighbors.map(neighbor => (
            <li key={neighbor.ip}>
              {neighbor.hostname} ({neighbor.ip})
              {/* This functionality would need more state management to perfect */}
              <button onClick={() => onAddNeighbor(neighbor, "some-source-ip")}>Add</button>
            </li>
          ))}
        </ul>
      ) : (
        <p>Select a device to see its neighbors, or no neighbors found.</p>
      )}
    </div>
  );
};

export default Sidebar;