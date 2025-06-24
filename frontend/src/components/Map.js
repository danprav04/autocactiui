import React from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
} from 'react-flow-renderer';

const Map = ({ nodes, edges, onNodeClick, onNodesChange, nodeTypes, theme }) => {
  
  const minimapNodeColor = (node) => {
    switch (node.type) {
      case 'custom':
        return theme === 'dark' ? '#a8b3cf' : '#6f81a4';
      default:
        return '#eee';
    }
  };

  return (
    <div className="map-view">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={onNodeClick}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        fitView
      >
        <MiniMap nodeColor={minimapNodeColor} />
        <Controls />
        <Background color={theme === 'dark' ? '#404040' : '#ddd'} gap={24} />
      </ReactFlow>
    </div>
  );
};

export default Map;