// frontend/src/components/Map.js
import React from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
} from 'react-flow-renderer';

const SnapLine = ({ type, style }) => {
  return <div className={`snap-line ${type}`} style={style} />;
};

const Map = ({ nodes, edges, onNodeClick, onNodesChange, onPaneClick, nodeTypes, theme, snapLines = [] }) => {
  
  const minimapNodeColor = (node) => {
    switch (node.type) {
      case 'custom':
        return theme === 'dark' ? '#a8b3cf' : '#6f81a4';
      case 'group':
        return node.data.color || '#e9ecef';
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
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
      >
        <MiniMap nodeColor={minimapNodeColor} />
        <Controls />
        <Background color={theme === 'dark' ? '#404040' : '#ddd'} gap={24} />
        {snapLines.map((line, i) => (
          <SnapLine 
            key={`${line.type}-${i}`} 
            type={line.type} 
            style={line.type === 'vertical' ? { left: line.x } : { top: line.y }} 
          />
        ))}
      </ReactFlow>
    </div>
  );
};

export default Map;