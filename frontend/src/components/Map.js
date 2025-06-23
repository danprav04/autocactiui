import React from 'react';
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
} from 'react-flow-renderer';

const Map = ({ nodes, edges, setNodes, setEdges }) => {
  const onConnect = (params) => setEdges((els) => addEdge(params, els));
  const onNodesChange = (changes) => {
    // This is a simplified way to handle node changes like dragging
    const updatedNodes = nodes.map(node => {
        const change = changes.find(c => c.id === node.id && c.type === 'position');
        if (change && change.position) {
            return { ...node, position: change.position };
        }
        return node;
    });
    setNodes(updatedNodes);
  };

  return (
    <div className="map-view">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onConnect={onConnect}
        fitView
      >
        <MiniMap />
        <Controls />
        <Background />
      </ReactFlow>
    </div>
  );
};

export default Map;