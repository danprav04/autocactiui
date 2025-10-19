// frontend/src/services/mapImportExportService.js

/**
 * Creates a JSON blob from the current map state and triggers a download.
 * @param {Array} nodes - The array of nodes from the map state.
 * @param {Array} edges - The array of edges from the map state.
 * @param {string} mapName - The current name of the map.
 */
export const downloadMapConfig = (nodes, edges, mapName) => {
    try {
        const mapData = {
            version: '1.0.0', // Add a version for future compatibility
            createdAt: new Date().toISOString(),
            mapName,
            nodes,
            edges,
        };

        const jsonString = JSON.stringify(mapData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        const sanitizedMapName = mapName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        link.download = `${sanitizedMapName}_config.json`;

        document.body.appendChild(link);
        link.click();

        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Failed to generate or download map configuration:", error);
        // In a real app, you might want to show a user-facing error here.
    }
};


/**
 * Reads a user-provided file, parses it as JSON, and validates its structure.
 * @param {File} file - The file object from a file input.
 * @returns {Promise<{nodes: Array, edges: Array, mapName: string}>} A promise that resolves with the imported map data.
 * @throws {Error} Throws an error if the file is invalid or cannot be parsed.
 */
export const importMapConfig = (file) => {
    return new Promise((resolve, reject) => {
        if (!file) {
            return reject(new Error('No file provided.'));
        }

        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);

                // Basic validation
                if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges) || typeof data.mapName !== 'string') {
                    throw new Error('Invalid or corrupted map configuration file.');
                }
                
                // More detailed validation can be added here, e.g., checking node/edge properties.

                resolve({
                    nodes: data.nodes,
                    edges: data.edges,
                    mapName: data.mapName,
                });

            } catch (error) {
                console.error("Failed to parse map configuration:", error);
                reject(new Error('Invalid or corrupted map configuration file.'));
            }
        };

        reader.onerror = (error) => {
            console.error("File reading error:", error);
            reject(new Error('Failed to read the provided file.'));
        };

        reader.readAsText(file);
    });
};