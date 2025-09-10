// frontend/src/services/mapExportService.js
import { toBlob } from 'html-to-image';
import { generateCactiConfig } from './configGenerator';
import { uploadMap } from './apiService';
import { ICONS_BY_THEME, NODE_WIDTH, NODE_HEIGHT } from '../config/constants';

/**
 * Calculates the exact bounding box of all nodes and the transform needed to position them for capture.
 * Ensures the final output is at least Full HD (1920x1080).
 * @param {Array} nodes - The array of all nodes on the map.
 * @returns {{width: number, height: number, translateX: number, translateY: number}}
 */
const calculateBoundsAndTransform = (nodes) => {
    const padding = 50;
    const MIN_WIDTH = 1920;
    const MIN_HEIGHT = 1080;

    if (nodes.length === 0) {
        return { width: MIN_WIDTH, height: MIN_HEIGHT, translateX: 0, translateY: 0 };
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    nodes.forEach(node => {
        const nodeWidth = node.type === 'group' ? node.data.width : NODE_WIDTH;
        const nodeHeight = node.type === 'group' ? node.data.height : NODE_HEIGHT;

        minX = Math.min(minX, node.position.x);
        minY = Math.min(minY, node.position.y);
        maxX = Math.max(maxX, node.position.x + nodeWidth);
        maxY = Math.max(maxY, node.position.y + nodeHeight);
    });

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    const finalWidth = Math.max(contentWidth + padding * 2, MIN_WIDTH);
    const finalHeight = Math.max(contentHeight + padding * 2, MIN_HEIGHT);

    const offsetX = (finalWidth - contentWidth) / 2;
    const offsetY = (finalHeight - contentHeight) / 2;

    return {
        width: finalWidth,
        height: finalHeight,
        translateX: -minX + offsetX,
        translateY: -minY + offsetY,
    };
};

/**
 * Captures the map view, generates a config, and uploads both to Cacti.
 * @param {object} params - The export parameters, including nodes with final absolute positions.
 * @returns {Promise<void>}
 */
export const exportAndUploadMap = async ({ mapElement, nodes, edges, mapName, cactiId, width, height }) => {
    const viewport = mapElement.querySelector('.react-flow__viewport');
    if (!viewport) {
        throw new Error('Could not find map viewport for export.');
    }

    // Since nodes are already in their final positions, ensure the viewport is not transformed.
    const originalTransform = viewport.style.transform;
    viewport.style.transform = 'translate(0px, 0px)';

    try {
        const blob = await toBlob(viewport, {
            width: width,
            height: height,
            backgroundColor: '#ffffff',
            filter: (node) => (node.className !== 'react-flow__controls'),
        });

        if (!blob) {
            throw new Error('Failed to create image blob.');
        }

        const configContent = generateCactiConfig({
            nodes: nodes, 
            edges, 
            mapName, 
            mapWidth: width, 
            mapHeight: height, 
        });
        console.log('[MapExport] Generated Cacti .conf content (for debugging):\n', configContent);

        const formData = new FormData();
        formData.append('map_image', blob, `${mapName}.png`);
        formData.append('config_content', configContent);
        formData.append('map_name', mapName);
        formData.append('cacti_installation_id', cactiId);

        console.log(`[MapExport] Uploading map '${mapName}' to Cacti installation ID ${cactiId}...`);
        await uploadMap(formData);
        console.log('[MapExport] Upload successful.');

    } finally {
        // Restore the original viewport transform after capture.
        viewport.style.transform = originalTransform;
    }
};

/**
 * A wrapper function that handles the entire map upload process, including temporary state changes.
 * @param {object} params - The export parameters, plus state setters.
 * @returns {Promise<void>}
 */
export const handleUploadProcess = async ({ mapElement, nodes, edges, mapName, cactiId, theme, setNodes, setEdges }) => {
    const originalNodes = [...nodes];
    const originalEdges = [...edges];
    const wasDarkTheme = theme === 'dark';

    // Step 1: Create a copy of the nodes with their base positions snapped to the nearest integer.
    const snappedNodes = originalNodes.map(n => ({
        ...n,
        position: {
            x: Math.round(n.position.x),
            y: Math.round(n.position.y)
        }
    }));

    // Step 2: Calculate the canvas size and translation needed based on the snapped node positions.
    const bounds = calculateBoundsAndTransform(snappedNodes);
    console.log('[MapExport] Debug Info:');
    console.log(`  - Original First Node Position: { x: ${originalNodes[0]?.position.x}, y: ${originalNodes[0]?.position.y} }`);
    console.log(`  - Snapped First Node Position: { x: ${snappedNodes[0]?.position.x}, y: ${snappedNodes[0]?.position.y} }`);
    console.log(`  - Calculated Bounds & Transform:`, bounds);

    // Step 3: Round the translation factors to integers. This is the critical fix.
    // Using Math.round() ensures alignment with browser rendering engines which typically
    // round to the nearest pixel when dealing with sub-pixel transforms.
    const translateX = Math.round(bounds.translateX);
    const translateY = Math.round(bounds.translateY);
    console.log(`  - Rounded Translation: { translateX: ${translateX}, translateY: ${translateY} }`);

    // Step 4: Create the final export nodes with pure-integer absolute positions.
    const exportNodes = snappedNodes.map(node => ({
        ...node,
        selected: false,
        data: {
            ...node.data,
            icon: node.type === 'custom' ? ICONS_BY_THEME[node.data.iconType].light : node.data.icon
        },
        position: {
            x: node.position.x + translateX,
            y: node.position.y + translateY
        }
    }));
    console.log(`  - Final First Node Position for Export: { x: ${exportNodes[0]?.position.x}, y: ${exportNodes[0]?.position.y} }`);
    
    // Step 5: Update the component state to render the nodes for the screenshot.
    setNodes(exportNodes);
    setEdges([]);
    mapElement.classList.add('exporting');
    if (wasDarkTheme) {
        document.body.setAttribute('data-theme', 'light');
    }

    // Step 6: Wait for the DOM to update.
    await new Promise(resolve => setTimeout(resolve, 200));
    
    try {
        // Step 7: Perform the export.
        await exportAndUploadMap({
            mapElement,
            nodes: exportNodes,
            edges: originalEdges,
            mapName,
            cactiId,
            width: bounds.width,
            height: bounds.height
        });
    } finally {
        // Step 8: Restore the original state of the map.
        mapElement.classList.remove('exporting');
        if (wasDarkTheme) {
            document.body.setAttribute('data-theme', 'dark');
        }
        setNodes(originalNodes);
        setEdges(originalEdges);
    }
};