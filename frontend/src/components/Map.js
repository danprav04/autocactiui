import React from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
} from 'react-flow-renderer';

const Map = ({ nodes, edges, onNodeClick, onNodesChange, nodeTypes }) => {
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
        <MiniMap />
        <Controls />
        <Background color="#aaa" gap={16} />
      </ReactFlow>
    </div>
  );
};

export default Map;