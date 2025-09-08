// frontend/src/components/Map.js
import React from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useViewport,
} from 'react-flow-renderer';

const SnapLines = ({ lines }) => {
  const { x, y, zoom } = useViewport();

  return (
    <div className="snap-line-svg">
      <svg width="100%" height="100%">
        {lines.map((line, i) => {
          if (line.type === 'vertical') {
            // Transform the pane-space x-coordinate to screen-space for the overlay SVG
            const screenX = line.x * zoom + x;
            return <line key={i} x1={screenX} y1={0} x2={screenX} y2="100%" />;
          }
          // horizontal
          // Transform the pane-space y-coordinate to screen-space for the overlay SVG
          const screenY = line.y * zoom + y;
          return <line key={i} x1={0} y1={screenY} x2="100%" y2={screenY} />;
        })}
      </svg>
    </div>
  );
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
        {snapLines.length > 0 && <SnapLines lines={snapLines} />}
      </ReactFlow>
    </div>
  );
};

export default Map;