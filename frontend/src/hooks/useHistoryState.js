// frontend/src/hooks/useHistoryState.js
import { useState, useCallback, useEffect } from 'react';

const getInitialState = () => {
  try {
    const savedNodes = localStorage.getItem('mapNodes');
    const savedEdges = localStorage.getItem('mapEdges');
    return {
      nodes: savedNodes ? JSON.parse(savedNodes) : [],
      edges: savedEdges ? JSON.parse(savedEdges) : [],
    };
  } catch (error) {
    console.error("Failed to parse map state from localStorage", error);
    return { nodes: [], edges: [] };
  }
};

export const useHistoryState = () => {
  const [historyData, setHistoryData] = useState({
    history: [getInitialState()],
    index: 0,
  });

  const { history, index } = historyData;
  const state = history[index];

  // This function is now stable and will not cause re-renders.
  const setState = useCallback((updater, overwrite = false) => {
    setHistoryData(currentData => {
      const currentState = currentData.history[currentData.index];
      const newState = typeof updater === 'function' ? updater(currentState) : updater;

      if (overwrite) {
        const newHistory = [...currentData.history];
        newHistory[currentData.index] = newState;
        return { ...currentData, history: newHistory };
      } else {
        const newHistory = currentData.history.slice(0, currentData.index + 1);
        newHistory.push(newState);
        return { history: newHistory, index: newHistory.length - 1 };
      }
    });
  }, [setHistoryData]);

  const undo = useCallback(() => {
    setHistoryData(data => (data.index > 0 ? { ...data, index: data.index - 1 } : data));
  }, [setHistoryData]);

  const redo = useCallback(() => {
    setHistoryData(data => (data.index < data.history.length - 1 ? { ...data, index: data.index + 1 } : data));
  }, [setHistoryData]);

  const resetState = useCallback(() => {
    const emptyState = { nodes: [], edges: [] };
    setHistoryData({ history: [emptyState], index: 0 });
    localStorage.removeItem('mapNodes');
    localStorage.removeItem('mapEdges');
  }, [setHistoryData]);

  useEffect(() => {
    if (state) {
      localStorage.setItem('mapNodes', JSON.stringify(state.nodes));
      localStorage.setItem('mapEdges', JSON.stringify(state.edges));
    }
  }, [state]);

  return {
    state,
    setState,
    undo,
    redo,
    resetState
  };
};