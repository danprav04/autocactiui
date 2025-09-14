// frontend/src/hooks/useTooling.js
import { useCallback } from 'react';
import { NODE_WIDTH, NODE_HEIGHT } from '../config/constants';

export const useTooling = (selectedElements, setState) => {

  const alignElements = useCallback((direction) => {
      if (selectedElements.length < 2) return;
      
      let anchor;
      switch (direction) {
          case 'left':
              anchor = Math.min(...selectedElements.map(el => el.position.x));
              break;
          case 'right':
              anchor = Math.max(...selectedElements.map(el => el.position.x + (el.width || NODE_WIDTH)));
              break;
          case 'top':
              anchor = Math.min(...selectedElements.map(el => el.position.y));
              break;
          case 'bottom':
              anchor = Math.max(...selectedElements.map(el => el.position.y + (el.height || NODE_HEIGHT)));
              break;
          case 'h-center':
              anchor = selectedElements.reduce((sum, el) => sum + el.position.x + (el.width || NODE_WIDTH) / 2, 0) / selectedElements.length;
              break;
          case 'v-center':
              anchor = selectedElements.reduce((sum, el) => sum + el.position.y + (el.height || NODE_HEIGHT) / 2, 0) / selectedElements.length;
              break;
          default: return;
      }
      
      const selectedIds = new Set(selectedElements.map(el => el.id));
      setState(prev => ({
        ...prev,
        nodes: prev.nodes.map(node => {
            if (!selectedIds.has(node.id)) return node;
            const newPos = { ...node.position };
            const width = node.width || NODE_WIDTH;
            const height = node.height || NODE_HEIGHT;
            
            if (direction === 'left') newPos.x = anchor;
            if (direction === 'right') newPos.x = anchor - width;
            if (direction === 'top') newPos.y = anchor;
            if (direction === 'bottom') newPos.y = anchor - height;
            if (direction === 'h-center') newPos.x = anchor - width / 2;
            if (direction === 'v-center') newPos.y = anchor - height / 2;
            
            return { ...node, position: newPos };
        })
      }));
  }, [selectedElements, setState]);

  const distributeElements = useCallback((direction) => {
      if (selectedElements.length < 3) return;

      const sorted = [...selectedElements].sort((a, b) => 
          direction === 'horizontal' ? a.position.x - b.position.x : a.position.y - b.position.y
      );

      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      
      let totalSpace, totalSize, startPos, endPos;
      if (direction === 'horizontal') {
          startPos = first.position.x;
          endPos = last.position.x;
          totalSpace = endPos - startPos;
          totalSize = sorted.reduce((sum, el) => sum + (el.width || NODE_WIDTH), 0);
      } else {
          startPos = first.position.y;
          endPos = last.position.y;
          totalSpace = endPos - startPos;
          totalSize = sorted.reduce((sum, el) => sum + (el.height || NODE_HEIGHT), 0);
      }

      const spacing = (totalSpace - totalSize) / (sorted.length - 1);
      let currentPos = startPos;
      
      if (direction === 'horizontal') {
        currentPos += (sorted[0].width || NODE_WIDTH) + spacing;
      } else {
        currentPos += (sorted[0].height || NODE_HEIGHT) + spacing;
      }

      const selectedIds = new Set(selectedElements.map(el => el.id));
      setState(prev => ({
        ...prev,
        nodes: prev.nodes.map(node => {
            if (!selectedIds.has(node.id)) return node;
            const sortedIndex = sorted.findIndex(s => s.id === node.id);
            if (sortedIndex === -1 || sortedIndex === 0 || sortedIndex === sorted.length - 1) return node;

            const el = sorted[sortedIndex];
            const newPos = { ...el.position };

            if (direction === 'horizontal') {
                newPos.x = currentPos;
                currentPos += (el.width || NODE_WIDTH) + spacing;
            } else {
                newPos.y = currentPos;
                currentPos += (el.height || NODE_HEIGHT) + spacing;
            }
            return { ...node, position: newPos };
        })
      }));
  }, [selectedElements, setState]);

  const changeZIndex = useCallback((direction) => {
      if (selectedElements.length === 0) return;
      
      const selectedIds = new Set(selectedElements.map(el => el.id));
      setState(prev => {
        const zIndexes = prev.nodes.map(n => n.zIndex || 0);
        const minZ = Math.min(...zIndexes);
        const maxZ = Math.max(...zIndexes);
        
        const newNodes = prev.nodes.map(node => {
            if (!selectedIds.has(node.id)) return node;
            const currentZ = node.zIndex || 0;
            let newZ = currentZ;
            
            switch(direction) {
                case 'front': newZ = maxZ + 1; break;
                case 'back': newZ = minZ - 1; break;
                case 'forward': newZ = currentZ + 1; break;
                case 'backward': newZ = currentZ - 1; break;
                default: break;
            }
            return { ...node, zIndex: newZ };
        });
        return { ...prev, nodes: newNodes };
      });
  }, [selectedElements, setState]);
  
  const selectAllByType = useCallback((iconType, updateSelection) => {
    setState(prev => {
      const selected = prev.nodes.filter(n => n.data.iconType === iconType);
      updateSelection(selected);
      return prev; // No state change, just side effect of selection
    }, true); // Overwrite state to avoid history entry for selection
  }, [setState]);

  return {
    alignElements,
    distributeElements,
    bringForward: () => changeZIndex('forward'),
    sendBackward: () => changeZIndex('backward'),
    bringToFront: () => changeZIndex('front'),
    sendToBack: () => changeZIndex('back'),
    selectAllByType,
  };
};