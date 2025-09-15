// frontend/src/services/mapExportService.js
import { toBlob } from 'html-to-image';
import { generateCactiConfig } from './configGenerator';
import { uploadMap } from './apiService';
import { ICONS_BY_THEME, NODE_WIDTH, NODE_HEIGHT } from '../config/constants';

/**
 * Prepares nodes and edges for a clean export by applying specific styles.
 * @param {Array} nodes - The original array of nodes.
 * @param {Array} edges - The original array of edges.
 * @returns {{exportNodes: Array, exportEdges: Array}} An object containing stylized nodes and edges.
 */
const prepareElementsForExport = (nodes, edges) => {
    const exportNodes = nodes.map(node => {
        const exportNode = {
            ...node,
            selected: false,
            className: 'export-node', // Add a universal class for export styling
        };

        // Force light-theme visuals for consistent exports
        if (node.type === 'custom') {
            exportNode.data = {
                ...node.data,
                icon: ICONS_BY_THEME[node.data.iconType].light,
            };
        } else if (node.type === 'text') {
            exportNode.data = {
                ...node.data,
                color: '#212529', // Force dark text for light background
            };
        }

        return exportNode;
    });
    
    const exportEdges = edges.map(edge => ({
        ...edge,
        animated: false,
        type: 'straight',
        style: { stroke: '#000000', strokeWidth: 2 }
    }));

    return { exportNodes, exportEdges };
};

/**
 * Calculates the exact bounding box of all nodes and the transform to position content for capture.
 * Ensures the final output is at least Full HD (1920x1080).
 * @param {Array} nodes - The array of all nodes on the map.
 * @returns {{width: number, height: number, transform: string, minX: number, minY: number, padding: number}}
 */
const calculateBoundsAndTransform = (nodes) => {
    const padding = 50;
    const MIN_WIDTH = 1920;
    const MIN_HEIGHT = 1080;

    if (nodes.length === 0) {
        return { width: MIN_WIDTH, height: MIN_HEIGHT, transform: 'translate(0,0)', minX: 0, minY: 0, padding };
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

    // Determine the final canvas size, ensuring it's at least HD resolution.
    const finalWidth = Math.max(contentWidth + padding * 2, MIN_WIDTH);
    const finalHeight = Math.max(contentHeight + padding * 2, MIN_HEIGHT);

    // Calculate offsets to center the content within the (potentially larger) canvas.
    const offsetX = (finalWidth - contentWidth) / 2;
    const offsetY = (finalHeight - contentHeight) / 2;

    const transform = `translate(${-minX + offsetX}px, ${-minY + offsetY}px)`;

    return {
        width: finalWidth,
        height: finalHeight,
        transform: transform,
        minX,
        minY,
        padding
    };
};

/**
 * Captures the map view, generates a config, and uploads both to Cacti.
 * @param {object} params - The export parameters.
 * @returns {Promise<void>}
 */
export const exportAndUploadMap = async ({ mapElement, nodes, edges, mapName, cactiId }) => {
    const viewport = mapElement.querySelector('.react-flow__viewport');
    if (!viewport) {
        throw new Error('Could not find map viewport for export.');
    }

    const { transform, width, height, minX, minY } = calculateBoundsAndTransform(nodes);
    const originalTransform = viewport.style.transform;
    viewport.style.transform = transform; 

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
        
        // Calculate the offsets needed to center the content in the final image.
        const contentWidth = (nodes.reduce((max, n) => Math.max(max, n.position.x + (n.type === 'group' ? n.data.width : NODE_WIDTH)), 0) - minX);
        const contentHeight = (nodes.reduce((max, n) => Math.max(max, n.position.y + (n.type === 'group' ? n.data.height : NODE_HEIGHT)), 0) - minY);
        const offsetX = (width - contentWidth) / 2;
        const offsetY = (height - contentHeight) / 2;


        // Create a new set of nodes with their positions transformed into the coordinate
        // system of the final PNG image, including the centering offset.
        const nodesForConfig = nodes.map(node => ({
            ...node,
            position: {
                x: node.position.x - minX + offsetX,
                y: node.position.y - minY + offsetY,
            },
        }));
        
        const configContent = generateCactiConfig({
            nodes: nodesForConfig, 
            edges, 
            mapName, 
            mapWidth: width, 
            mapHeight: height, 
        });
        
        const formData = new FormData();
        formData.append('map_image', blob, `${mapName}.png`);
        formData.append('config_content', configContent);
        formData.append('map_name', mapName);
        formData.append('cacti_installation_id', cactiId);

        await uploadMap(formData);

    } finally {
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

    const { exportNodes, exportEdges } = prepareElementsForExport(nodes, edges);
    setNodes(exportNodes);
    setEdges(exportEdges);
    mapElement.classList.add('exporting');
    if (wasDarkTheme) {
        document.body.setAttribute('data-theme', 'light');
    }

    await new Promise(resolve => setTimeout(resolve, 200));
    
    try {
        await exportAndUploadMap({ mapElement, nodes: exportNodes, edges: exportEdges, mapName, cactiId });
    } finally {
        mapElement.classList.remove('exporting');
        if (wasDarkTheme) {
            document.body.setAttribute('data-theme', 'dark');
        }
        setNodes(originalNodes);
        setEdges(originalEdges);
    }
};