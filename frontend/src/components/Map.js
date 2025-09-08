// frontend/src/components/Map.js
import React, { useRef, useState, useLayoutEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useViewport,
} from 'react-flow-renderer';

const SnapLines = ({ lines }) => {
  const { x, y, zoom } = useViewport();
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // This effect observes the container and updates dimensions on resize.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (container) {
      const resizeObserver = new ResizeObserver(() => {
        setDimensions({
          width: container.clientWidth,
          height: container.clientHeight,
        });
      });
      resizeObserver.observe(container);
      return () => resizeObserver.disconnect();
    }
  }, []);
  
  // Calculate the boundaries of the visible area in the flow's coordinate system
  const viewX = -x / zoom;
  const viewY = -y / zoom;
  const viewWidth = dimensions.width / zoom;
  const viewHeight = dimensions.height / zoom;

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', pointerEvents: 'none' }}>
      {lines.map((line, i) => (
        <svg key={i} className="snap-line-svg">
          {line.type === 'vertical' ? (
            <line x1={line.x} y1={viewY} x2={line.x} y2={viewY + viewHeight} />
          ) : (
            <line x1={viewX} y1={line.y} x2={viewX + viewWidth} y2={line.y} />
          )}
        </svg>
      ))}
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
        <SnapLines lines={snapLines} />
      </ReactFlow>
    </div>
  );
};

export default Map;