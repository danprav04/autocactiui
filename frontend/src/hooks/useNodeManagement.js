// frontend/src/hooks/useNodeManagement.js
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ICONS_BY_THEME, NODE_WIDTH, NODE_HEIGHT } from '../config/constants';

export const useNodeManagement = (theme, setState) => {
  const { t } = useTranslation();

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
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      zIndex: 10
    };
  }, [theme]);

  const handleDeleteElements = useCallback((selectedElements) => {
    if (selectedElements.length === 0) return;
    const selectedIds = new Set(selectedElements.map(el => el.id));

    setState(prevState => {
        // Determine if any selected node is the source of the current previews
        const shouldClearPreviews = prevState.edges.some(e => 
            e.data.isPreview && selectedIds.has(e.source)
        );

        // Filter nodes: remove selected nodes, and also remove preview nodes if their source is being deleted.
        const nextNodes = prevState.nodes.filter(n => {
            if (selectedIds.has(n.id)) return false;
            if (n.data.isPreview && shouldClearPreviews) return false;
            return true;
        });

        // Filter edges: remove edges connected to selected nodes, and also remove preview edges if their source is deleted.
        const nextEdges = prevState.edges.filter(e => {
            if (selectedIds.has(e.source) || selectedIds.has(e.target)) return false;
            if (e.data.isPreview && shouldClearPreviews) return false;
            return true;
        });

        return {
            nodes: nextNodes,
            edges: nextEdges,
        };
    });
  }, [setState]);

  const handleUpdateNodeData = useCallback((nodeId, updatedData, addToHistory = true) => {
    setState(prevState => {
      const newNodes = prevState.nodes.map(n => {
        if (n.id === nodeId) {
          let finalData = { ...n.data, ...updatedData };
          if (n.type === 'custom') {
              const newIconType = updatedData.iconType || n.data.iconType;
              finalData.icon = ICONS_BY_THEME[newIconType][theme];
          }
          return { ...n, data: finalData };
        }
        return n;
      });
      return { ...prevState, nodes: newNodes };
    }, !addToHistory); // Overwrite history if addToHistory is false
  }, [theme, setState]);

  const handleAddGroup = useCallback(() => {
    const newGroup = {
      id: `group_${Date.now()}`,
      type: 'group',
      position: { x: 200, y: 200 },
      data: {
        label: t('sidebar.newGroupName'),
        color: '#cfe2ff', width: 400, height: 300, opacity: 0.6,
        shape: 'rounded-rectangle',
        borderColor: '#8a8d91', borderStyle: 'dashed', borderWidth: 1,
      },
      zIndex: 1
    };
    setState(prev => ({ ...prev, nodes: [...prev.nodes, newGroup] }));
  }, [t, setState]);
  
  const handleAddTextNode = useCallback(() => {
      const newNode = {
          id: `text_${Date.now()}`,
          type: 'text',
          position: {x: 300, y: 100},
          data: {
              text: 'New Text',
              fontSize: 16,
              color: theme === 'dark' ? '#e4e6eb' : '#212529'
          },
          zIndex: 10
      };
      setState(prev => ({ ...prev, nodes: [...prev.nodes, newNode] }));
  }, [setState, theme]);

  return {
    createNodeObject,
    handleDeleteElements,
    handleUpdateNodeData,
    handleAddGroup,
    handleAddTextNode,
  };
};