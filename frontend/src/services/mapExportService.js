// frontend/src/services/mapExportService.js
import { toBlob } from 'html-to-image';
import { generateCactiConfig } from './configGenerator';
import { uploadMap } from './apiService';
import { ICONS_BY_THEME } from '../config/constants';

/**
 * Prepares nodes and edges for a clean export by applying specific styles.
 * @param {Array} nodes - The original array of nodes.
 * @param {Array} edges - The original array of edges.
 * @returns {{exportNodes: Array, exportEdges: Array}} An object containing stylized nodes and edges.
 */
const prepareElementsForExport = (nodes, edges) => {
    const exportNodes = nodes.map(node => ({
        ...node,
        selected: false,
        data: {
            ...node.data,
            // Force light theme icons for consistent backgrounds
            icon: ICONS_BY_THEME[node.data.iconType].light
        }
    }));
    
    const exportEdges = edges.map(edge => ({
        ...edge,
        animated: false,
        type: 'straight',
        style: { stroke: '#000000', strokeWidth: 2 }
    }));

    return { exportNodes, exportEdges };
};

/**
 * Calculates the optimal transform (zoom and pan) to fit all nodes within a 720p frame.
 * @param {Array} nodes - The array of nodes to be framed.
 * @returns {{transform: string, width: number, height: number}} The CSS transform string and target dimensions.
 */
const calculateExportTransform = (nodes) => {
    const targetWidth = 1280;
    const targetHeight = 720;
    const padding = 80; // Margin within the 720p frame

    // Dimensions based on .custom-node CSS
    const nodeWidth = 150;
    const nodeHeight = 110;

    if (nodes.length === 0) {
        return { transform: 'translate(0,0) scale(1)', width: targetWidth, height: targetHeight };
    }
    
    const minX = Math.min(...nodes.map(n => n.position.x));
    const minY = Math.min(...nodes.map(n => n.position.y));
    const maxX = Math.max(...nodes.map(n => n.position.x + nodeWidth));
    const maxY = Math.max(...nodes.map(n => n.position.y + nodeHeight));

    const boundsWidth = maxX - minX;
    const boundsHeight = maxY - minY;

    const scaleX = (targetWidth - padding * 2) / boundsWidth;
    const scaleY = (targetHeight - padding * 2) / boundsHeight;
    const scale = Math.min(scaleX, scaleY, 1); // Do not scale up beyond 100%

    const translateX = ((targetWidth - (boundsWidth * scale)) / 2) - (minX * scale);
    const translateY = ((targetHeight - (boundsHeight * scale)) / 2) - (minY * scale);
    
    return {
        transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
        width: targetWidth,
        height: targetHeight,
    };
};

/**
 * Captures the current map view as a blob, generates a config, and uploads both to Cacti.
 * @param {object} params - The export parameters.
 * @param {HTMLElement} params.mapElement - The React Flow wrapper element.
 * @param {Array} params.nodes - The current nodes.
 * @param {Array} params.edges - The current edges.
 * @param {string} params.mapName - The name of the map.
 * @param {string} params.cactiId - The ID of the target Cacti installation.
 * @returns {Promise<void>} A promise that resolves on success or rejects on failure.
 */
export const exportAndUploadMap = async ({ mapElement, nodes, edges, mapName, cactiId }) => {
    const viewport = mapElement.querySelector('.react-flow__viewport');
    if (!viewport) {
        throw new Error('Could not find map viewport for export.');
    }

    const { transform, width, height } = calculateExportTransform(nodes);
    const originalTransform = viewport.style.transform;
    viewport.style.transform = transform; // Apply calculated transform for capturing

    try {
        const blob = await toBlob(viewport, {
            width: width,
            height: height,
            backgroundColor: '#ffffff',
            // Filter out the React Flow controls from the captured image
            filter: (node) => (node.className !== 'react-flow__controls'),
        });

        if (!blob) {
            throw new Error('Failed to create image blob.');
        }

        const configContent = generateCactiConfig(nodes, edges, mapName);
        const formData = new FormData();
        formData.append('map_image', blob, `${mapName}.png`);
        formData.append('config_content', configContent);
        formData.append('map_name', mapName);
        formData.append('cacti_installation_id', cactiId);

        await uploadMap(formData);

    } finally {
        // Always restore the original transform after capturing
        viewport.style.transform = originalTransform;
    }
};

/**
 * A wrapper function that handles the entire map upload process, including temporary state changes.
 * @param {object} params - The export parameters, same as exportAndUploadMap.
 * @param {function} params.setNodes - React state setter for nodes.
 * @param {function} params.setEdges - React state setter for edges.
 * @returns {Promise<void>} A promise that resolves on success or rejects on failure.
 */
export const handleUploadProcess = async ({ mapElement, nodes, edges, mapName, cactiId, theme, setNodes, setEdges }) => {
    const originalNodes = [...nodes];
    const originalEdges = [...edges];
    const wasDarkTheme = theme === 'dark';

    // Prepare UI for export
    const { exportNodes, exportEdges } = prepareElementsForExport(nodes, edges);
    setNodes(exportNodes);
    setEdges(exportEdges);
    mapElement.classList.add('exporting');
    if (wasDarkTheme) {
        document.body.setAttribute('data-theme', 'light');
    }

    // A short timeout allows React to re-render with the export styles before we take the screenshot.
    await new Promise(resolve => setTimeout(resolve, 200));
    
    try {
        await exportAndUploadMap({ mapElement, nodes: originalNodes, edges: originalEdges, mapName, cactiId });
    } finally {
        // Restore original UI state
        mapElement.classList.remove('exporting');
        if (wasDarkTheme) {
            document.body.setAttribute('data-theme', 'dark');
        }
        setNodes(originalNodes);
        setEdges(originalEdges);
    }
};