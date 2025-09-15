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

    setState(prev => {
        const selectedIds = new Set(selectedElements.map(el => el.id));
        let allNodes = prev.nodes.map(n => ({ ...n, zIndex: n.zIndex || 0 }));

        if (direction === 'front' || direction === 'back') {
            const zIndexes = allNodes.map(n => n.zIndex);
            const minZ = Math.min(...zIndexes);
            const maxZ = Math.max(...zIndexes);
            
            allNodes = allNodes.map(node => {
                if (selectedIds.has(node.id)) {
                    return { ...node, zIndex: direction === 'front' ? maxZ + 1 : minZ - 1 };
                }
                return node;
            });
        } else {
            // Sort nodes by zIndex to establish a clear visual stack
            allNodes.sort((a, b) => a.zIndex - b.zIndex);

            if (direction === 'forward') {
                // Iterate backwards to prevent a single node from moving multiple steps
                for (let i = allNodes.length - 2; i >= 0; i--) {
                    const currentNode = allNodes[i];
                    const nextNode = allNodes[i + 1];
                    if (selectedIds.has(currentNode.id) && !selectedIds.has(nextNode.id)) {
                        // Swap zIndex
                        [currentNode.zIndex, nextNode.zIndex] = [nextNode.zIndex, currentNode.zIndex];
                    }
                }
            } else if (direction === 'backward') {
                // Iterate forwards to handle multiple selections moving down together
                for (let i = 1; i < allNodes.length; i++) {
                    const currentNode = allNodes[i];
                    const prevNode = allNodes[i - 1];
                    if (selectedIds.has(currentNode.id) && !selectedIds.has(prevNode.id)) {
                        // Swap zIndex
                        [currentNode.zIndex, prevNode.zIndex] = [prevNode.zIndex, currentNode.zIndex];
                    }
                }
            }
        }
        
        return { ...prev, nodes: allNodes };
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