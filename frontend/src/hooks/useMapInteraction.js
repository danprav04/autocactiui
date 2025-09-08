// frontend/src/hooks/useMapInteraction.js
import { useState, useCallback, useEffect } from 'react';
import { applyNodeChanges } from 'react-flow-renderer';
import { useTranslation } from 'react-i18next';
import * as api from '../services/apiService';
import { ICONS_BY_THEME, NODE_WIDTH, NODE_HEIGHT, SNAP_THRESHOLD } from '../config/constants';

export const useMapInteraction = (theme) => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedElement, setSelectedElement] = useState(null);
  const [neighbors, setNeighbors] = useState([]);
  const [snapLines, setSnapLines] = useState([]);
  const { t } = useTranslation();

  // Effect to update node icons automatically when the theme changes
  useEffect(() => {
    setNodes(nds =>
        nds.map(node => {
            if (node.type !== 'custom') return node;
            const iconType = node.data.iconType;
            if (iconType && ICONS_BY_THEME[iconType]) {
                return { ...node, data: { ...node.data, icon: ICONS_BY_THEME[iconType][theme] } };
            }
            return node;
        })
    );
  }, [theme, setNodes]);

  const createNodeObject = useCallback((device, position, explicitIconName) => {
    const discoveredType = device.type;
    let finalIconName = explicitIconName;

    if (!finalIconName) {
      finalIconName = ICONS_BY_THEME[discoveredType] ? discoveredType : 'Unknown';
    }
    
    return {
      id: device.ip,
      type: 'custom',
      position: position || { x: (Math.random() * 400) + 100, y: (Math.random() * 400) + 50 },
      data: { 
        hostname: device.hostname, 
        ip: device.ip,
        iconType: finalIconName,
        icon: ICONS_BY_THEME[finalIconName][theme]
      },
      zIndex: 10
    };
  }, [theme]);

  const onNodesChange = useCallback((changes) => {
    const dragChange = changes.find(c => c.type === 'position' && c.dragging);

    if (dragChange) {
        const draggedNode = nodes.find(n => n.id === dragChange.id);

        if (!dragChange.position || !draggedNode || draggedNode.type !== 'custom') {
            setSnapLines([]);
            setNodes(nds => applyNodeChanges(changes, nds));
            return;
        }
        
        const newPos = { ...dragChange.position };
        let bestSnapX = { dist: Infinity };
        let bestSnapY = { dist: Infinity };

        for (const otherNode of nodes) {
            if (otherNode.id === draggedNode.id) continue;

            const otherNodeWidth = otherNode.type === 'group' ? otherNode.data.width : NODE_WIDTH;
            const otherNodeHeight = otherNode.type === 'group' ? otherNode.data.height : NODE_HEIGHT;

            const otherPointsX = [ otherNode.position.x, otherNode.position.x + otherNodeWidth / 2, otherNode.position.x + otherNodeWidth ];
            const otherPointsY = [ otherNode.position.y, otherNode.position.y + otherNodeHeight / 2, otherNode.position.y + otherNodeHeight ];

            if (otherNode.type === 'group') {
                otherPointsX.push(otherNode.position.x + otherNodeWidth / 3);
                otherPointsX.push(otherNode.position.x + (otherNodeWidth * 2) / 3);
                otherPointsY.push(otherNode.position.y + otherNodeHeight / 3);
                otherPointsY.push(otherNode.position.y + (otherNodeHeight * 2) / 3);
            }

            const draggedPointsX = [newPos.x, newPos.x + NODE_WIDTH / 2, newPos.x + NODE_WIDTH];
            const draggedPointsY = [newPos.y, newPos.y + NODE_HEIGHT / 2, newPos.y + NODE_HEIGHT];

            for (let i = 0; i < draggedPointsX.length; i++) {
                for (const p of otherPointsX) {
                    const dist = Math.abs(draggedPointsX[i] - p);
                    if (dist < SNAP_THRESHOLD && dist < bestSnapX.dist) {
                        bestSnapX = { dist, pos: p, align: i }; // 0=left, 1=center, 2=right
                    }
                }
            }
            
            for (let i = 0; i < draggedPointsY.length; i++) {
                for (const p of otherPointsY) {
                    const dist = Math.abs(draggedPointsY[i] - p);
                    if (dist < SNAP_THRESHOLD && dist < bestSnapY.dist) {
                        bestSnapY = { dist, pos: p, align: i }; // 0=top, 1=center, 2=bottom
                    }
                }
            }
        }
        
        const newSnapLines = [];
        if (bestSnapX.pos !== undefined) {
            if (bestSnapX.align === 0) newPos.x = bestSnapX.pos;
            if (bestSnapX.align === 1) newPos.x = bestSnapX.pos - NODE_WIDTH / 2;
            if (bestSnapX.align === 2) newPos.x = bestSnapX.pos - NODE_WIDTH;
            newSnapLines.push({ type: 'vertical', x: bestSnapX.pos });
        }
        if (bestSnapY.pos !== undefined) {
            if (bestSnapY.align === 0) newPos.y = bestSnapY.pos;
            if (bestSnapY.align === 1) newPos.y = bestSnapY.pos - NODE_HEIGHT / 2;
            if (bestSnapY.align === 2) newPos.y = bestSnapY.pos - NODE_HEIGHT;
            newSnapLines.push({ type: 'horizontal', y: bestSnapY.pos });
        }

        dragChange.position = newPos;
        setSnapLines(newSnapLines);
    } else if (changes.some(c => c.type === 'position' && !c.dragging)) {
        setSnapLines([]);
    }

    setNodes(nds => applyNodeChanges(changes, nds));
  }, [nodes]);

  const handleFetchNeighbors = useCallback(async (ip, setLoading, setError) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.getDeviceNeighbors(ip);
      setNeighbors(response.data.neighbors.filter(n => !nodes.some(node => node.id === n.ip)));
    } catch (err) {
      setError(t('app.errorFetchNeighbors', { ip }));
      setNeighbors([]);
    } finally {
      setLoading(false);
    }
  }, [nodes, t]);

  const onNodeClick = useCallback((event, node, setLoading, setError) => {
    setNodes(nds => nds.map(n => ({ ...n, selected: n.id === node.id })));
    setSelectedElement(node);
    if (node.type === 'custom') {
        handleFetchNeighbors(node.id, setLoading, setError);
    } else {
        setNeighbors([]);
    }
  }, [handleFetchNeighbors]);

  const onPaneClick = useCallback(() => {
    setNodes(nds => nds.map(n => ({...n, selected: false})));
    setSelectedElement(null);
    setNeighbors([]);
  }, []);

  const handleAddNeighbor = useCallback(async (neighbor, setLoading, setError) => {
    if (!selectedElement || selectedElement.type !== 'custom' || nodes.some(n => n.id === neighbor.ip)) return;
    
    setLoading(true);
    setError('');
    try {
      const deviceResponse = await api.getDeviceInfo(neighbor.ip);
      if (!deviceResponse.data || deviceResponse.data.error) throw new Error(`No info for ${neighbor.ip}`);
      
      const newPosition = { x: selectedElement.position.x + (Math.random() * 250 - 125), y: selectedElement.position.y + 150 };
      const newNode = createNodeObject(deviceResponse.data, newPosition);

      const primaryEdge = {
          id: `e-${selectedElement.id}-${newNode.id}`,
          source: selectedElement.id,
          target: newNode.id,
          animated: true,
          style: { stroke: '#6c757d' },
          data: { interface: neighbor.interface }
      };
      
      const neighborsOfNewNode = (await api.getDeviceNeighbors(newNode.id)).data.neighbors || [];
      const currentNodes = [...nodes, newNode];
      const currentEdges = [...edges, primaryEdge]; 

      const secondaryEdges = neighborsOfNewNode.reduce((acc, newNeighbor) => {
          const existingNode = currentNodes.find(n => n.id === newNeighbor.ip);
          
          // **THE FIX IS HERE**
          // First, check if the neighbor node already exists on the map.
          if (existingNode) {
              // Only if it exists, check if an edge already connects them.
              const edgeExists = currentEdges.some(e => 
                  (e.source === newNode.id && e.target === existingNode.id) || 
                  (e.source === existingNode.id && e.target === newNode.id)
              );
              
              // If the node exists but an edge doesn't, create the new edge.
              if (!edgeExists) {
                  acc.push({ 
                      id: `e-${newNode.id}-${existingNode.id}`, 
                      source: newNode.id, 
                      target: existingNode.id, 
                      animated: true, 
                      style: { stroke: '#6c757d' },
                      data: { interface: newNeighbor.interface }
                  });
              }
          }
          return acc;
      }, []);

      setNodes(prev => [...prev, newNode]);
      setEdges(prev => [...prev, primaryEdge, ...secondaryEdges]);
      setNeighbors(prev => prev.filter(n => n.ip !== neighbor.ip));
    } catch(err) {
        setError(t('app.errorAddNeighbor', {ip: neighbor.ip}));
        console.error(err);
    } finally {
        setLoading(false);
    }
  }, [createNodeObject, selectedElement, nodes, edges, t]);

  const handleDeleteNode = useCallback(() => {
    if (!selectedElement) return;
    const { id, type } = selectedElement;

    if (type === 'custom') {
        setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
    }
    
    setNodes(nds => nds.filter(n => n.id !== id));
    setSelectedElement(null);
    setNeighbors([]);
  }, [selectedElement]);

  const handleUpdateNodeData = useCallback((nodeId, updatedData) => {
    setNodes(nds => nds.map(n => {
      if (n.id === nodeId) {
        let finalData = { ...n.data, ...updatedData };
        if (n.type === 'custom') {
            const newIconType = updatedData.iconType || n.data.iconType;
            finalData.icon = ICONS_BY_THEME[newIconType][theme];
        }
        
        const updatedNode = { ...n, data: finalData };
        
        if (selectedElement && selectedElement.id === nodeId) {
          setSelectedElement(updatedNode);
        }
        return updatedNode;
      }
      return n;
    }));
  }, [theme, selectedElement]);

  const handleAddGroup = useCallback(() => {
    const newGroup = {
      id: `group_${Date.now()}`,
      type: 'group',
      position: { x: 200, y: 200 },
      data: {
        label: t('sidebar.newGroupName'),
        color: '#cfe2ff',
        width: 400,
        height: 300,
        opacity: 0.6
      },
      zIndex: 0
    };
    setNodes(nds => [...nds, newGroup]);
  }, [t]);

  const resetMap = () => {
    setNodes([]);
    setEdges([]);
    setSelectedElement(null);
    setNeighbors([]);
  };

  return {
    nodes, setNodes,
    edges, setEdges,
    selectedElement,
    neighbors,
    snapLines,
    onNodesChange,
    onNodeClick,
    onPaneClick,
    handleAddNeighbor,
    handleDeleteNode,
    handleUpdateNodeData,
    handleAddGroup,
    createNodeObject,
    resetMap,
  };
};