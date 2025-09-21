// frontend/src/components/Map.js
import React, { useState, useRef, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  useViewport,
} from 'react-flow-renderer';

const MarqueeSelection = ({ startPos, endPos }) => {
    if (!startPos || !endPos) return null;

    const style = {
        left: Math.min(startPos.x, endPos.x),
        top: Math.min(startPos.y, endPos.y),
        width: Math.abs(startPos.x - endPos.x),
        height: Math.abs(startPos.y - endPos.y),
    };

    return <div className="marquee-selection" style={style} />;
};

const SnapLines = ({ lines }) => {
    const { zoom } = useViewport();
    if (!lines.length) return null;

    // By rendering the lines as children of ReactFlow, they are automatically
    // positioned within the pane. We just need to counteract the zoom's effect
    // on the line thickness (width/height).
    return (
        <>
            {lines.map((line, i) => (
                <div
                    key={i}
                    className={`snap-line ${line.type}`}
                    style={
                        line.type === 'vertical'
                            ? { left: line.x, top: line.y1, height: line.y2 - line.y1, width: `${1 / zoom}px` }
                            : { top: line.y, left: line.x1, width: line.x2 - line.x1, height: `${1 / zoom}px` }
                    }
                />
            ))}
        </>
    );
};


const Map = ({ nodes, edges, onNodeClick, onNodesChange, onPaneClick, onSelectionChange, nodeTypes, theme, setReactFlowInstance, onNodeContextMenu, snapLines }) => {
  
  const [marqueeStart, setMarqueeStart] = useState(null);
  const [marqueeEnd, setMarqueeEnd] = useState(null);
  const mapRef = useRef(null);
  const reactFlowInstance = useReactFlow();

  if (setReactFlowInstance) {
    setReactFlowInstance(reactFlowInstance);
  }

  const minimapNodeColor = (node) => {
    switch (node.type) {
      case 'custom':
        return theme === 'dark' ? '#a8b3cf' : '#6f81a4';
      case 'group':
        return node.data.color || '#e9ecef';
      case 'text':
        return 'transparent';
      default:
        return '#eee';
    }
  };

  const handlePaneMouseDown = (event) => {
      // Start marquee selection only on primary button click and if not clicking a control
      if (event.button !== 0 || event.target.closest('.react-flow__controls')) return;

      event.preventDefault();
      const mapBounds = mapRef.current.getBoundingClientRect();
      setMarqueeStart({
          x: event.clientX - mapBounds.left,
          y: event.clientY - mapBounds.top,
      });
      setMarqueeEnd({
          x: event.clientX - mapBounds.left,
          y: event.clientY - mapBounds.top,
      });
  };

  const handlePaneMouseMove = (event) => {
      if (!marqueeStart) return;
      
      const mapBounds = mapRef.current.getBoundingClientRect();
      setMarqueeEnd({
          x: event.clientX - mapBounds.left,
          y: event.clientY - mapBounds.top,
      });
  };
  
  const handlePaneMouseUp = useCallback((event) => {
      if (marqueeStart && marqueeEnd) {
          const selectionRect = {
              x: Math.min(marqueeStart.x, marqueeEnd.x),
              y: Math.min(marqueeStart.y, marqueeEnd.y),
              width: Math.abs(marqueeStart.x - marqueeEnd.x),
              height: Math.abs(marqueeStart.y - marqueeEnd.y),
          };

          // A small marquee is likely a click, so trigger pane click instead
          if (selectionRect.width < 5 && selectionRect.height < 5) {
              onPaneClick(event);
          } else {
              const selectedNodes = reactFlowInstance.getNodes().filter(node => {
                  const nodePosition = reactFlowInstance.project({ x: node.position.x, y: node.position.y });
                  const nodeWidth = node.width || 100;
                  const nodeHeight = node.height || 50;

                  return (
                      nodePosition.x + nodeWidth > selectionRect.x &&
                      nodePosition.x < selectionRect.x + selectionRect.width &&
                      nodePosition.y + nodeHeight > selectionRect.y &&
                      nodePosition.y < selectionRect.y + selectionRect.height
                  );
              });
              onSelectionChange({ nodes: selectedNodes, edges: [] });
          }
      } else if (event.button === 0) { // Handle simple clicks that didn't start a marquee
        onPaneClick(event);
      }
      setMarqueeStart(null);
      setMarqueeEnd(null);
  }, [marqueeStart, marqueeEnd, reactFlowInstance, onSelectionChange, onPaneClick]);

  return (
    <div 
        className="map-view"
        ref={mapRef}
        onMouseDown={handlePaneMouseDown}
        onMouseMove={handlePaneMouseMove}
        onMouseUp={handlePaneMouseUp}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={onNodeClick}
        onNodesChange={onNodesChange}
        onNodeContextMenu={onNodeContextMenu}
        // Use custom pane interaction handlers instead of onPaneClick
        onPaneClick={undefined} 
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        fitView
        selectionOnDrag={false} // Disable default drag selection
      >
        <MiniMap nodeColor={minimapNodeColor} />
        <Controls />
        <Background color={theme === 'dark' ? '#404040' : '#ddd'} gap={24} />
        <SnapLines lines={snapLines} />
      </ReactFlow>
      <MarqueeSelection startPos={marqueeStart} endPos={marqueeEnd} />
    </div>
  );
};

export default Map;