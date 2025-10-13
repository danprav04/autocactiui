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

// Fixed SnapLines component in Map.js
const SnapLines = ({ lines }) => {
    const { zoom, x, y } = useViewport();
    if (!lines.length) return null;

    // Transform ReactFlow coordinates to screen coordinates
    // ReactFlow applies: translate(x, y) scale(zoom) to the viewport
    return (
        <>
            {lines.map((line, i) => {
                if (line.type === 'vertical') {
                    const screenX = line.x * zoom + x;
                    const screenY1 = line.y1 * zoom + y;
                    const screenY2 = line.y2 * zoom + y;
                    
                    return (
                        <div
                            key={i}
                            className="snap-line vertical"
                            style={{
                                position: 'absolute',
                                left: screenX,
                                top: Math.min(screenY1, screenY2),
                                height: Math.abs(screenY2 - screenY1),
                                width: '1px',
                                backgroundColor: 'var(--snap-line-color)',
                                zIndex: 1000,
                                pointerEvents: 'none'
                            }}
                        />
                    );
                } else {
                    const screenY = line.y * zoom + y;
                    const screenX1 = line.x1 * zoom + x;
                    const screenX2 = line.x2 * zoom + x;
                    
                    return (
                        <div
                            key={i}
                            className="snap-line horizontal"
                            style={{
                                position: 'absolute',
                                top: screenY,
                                left: Math.min(screenX1, screenX2),
                                width: Math.abs(screenX2 - screenX1),
                                height: '1px',
                                backgroundColor: 'var(--snap-line-color)',
                                zIndex: 1000,
                                pointerEvents: 'none'
                            }}
                        />
                    );
                }
            })}
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
        selectNodesOnDrag={false} // Corrected prop name
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