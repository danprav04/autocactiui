import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import apiService from './apiService'; // Ensure this import exists

// --- UTILITIES ---

const sanitizeFilename = (name) => (name || 'map').replace(/[^a-z0-9]/gi, '_').toLowerCase();

// --- MAIN EXPORTS ---

export const exportToVisio = async (nodes, edges, mapName) => {
    try {
        const mapData = {
            mapName,
            nodes,
            edges
        };
        const response = await apiService.post('/export-visio', mapData, {
            responseType: 'blob',
        });
        const blob = new Blob([response.data], { type: 'application/vnd.visio' });
        saveAs(blob, `${sanitizeFilename(mapName)}.vsdx`);
    } catch (error) {
        console.error("Failed to export to Visio:", error);
        alert("Failed to export to Visio. See console for details.");
    }
};

export const downloadMapConfig = (nodes, edges, mapName) => {
    try {
        const mapData = {
            version: '1.0.0',
            createdAt: new Date().toISOString(),
            mapName,
            nodes,
            edges,
        };

        const jsonString = JSON.stringify(mapData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        saveAs(blob, `${sanitizeFilename(mapName)}_config.json`);
    } catch (error) {
        console.error("Failed to generate or download map configuration:", error);
    }
};

export const exportToExcel = (nodes, edges, mapName) => {
    try {
        const validNodes = nodes.filter(n => !n.data?.isPreview);
        const validEdges = edges.filter(e => !e.data?.isPreview);

        const devicePortsMap = new Map();
        validEdges.forEach(edge => {
            const iface = edge.data?.interface || 'unknown';
            const targetNode = validNodes.find(n => n.id === edge.target);
            const targetName = targetNode?.data?.hostname || edge.target;
            if (!devicePortsMap.has(edge.source)) devicePortsMap.set(edge.source, []);
            devicePortsMap.get(edge.source).push(`${iface} (to ${targetName})`);
        });

        const wb = XLSX.utils.book_new();

        const devicesData = validNodes
            .filter(n => n.type === 'custom')
            .map(n => {
                const ports = devicePortsMap.get(n.id) || [];
                return {
                    Hostname: n.data.hostname,
                    IP_Address: n.data.ip || 'N/A',
                    Type: n.data.iconType,
                    Connected_Interfaces: ports.join(', '),
                    Position_X: Math.round(n.position.x),
                    Position_Y: Math.round(n.position.y),
                    Internal_ID: n.id
                };
            });

        const wsDevices = XLSX.utils.json_to_sheet(devicesData);
        wsDevices['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 50 }, { wch: 12 }, { wch: 12 }, { wch: 25 }];
        XLSX.utils.book_append_sheet(wb, wsDevices, "Devices");

        const linksData = validEdges.map(e => {
            const source = validNodes.find(n => n.id === e.source)?.data || {};
            const target = validNodes.find(n => n.id === e.target)?.data || {};
            return {
                Source_Hostname: source.hostname || 'Unknown',
                Source_IP: source.ip || 'N/A',
                Target_Hostname: target.hostname || 'Unknown',
                Target_IP: target.ip || 'N/A',
                Interface: e.data?.interface || 'N/A',
                Bandwidth: e.data?.bandwidth || 'N/A'
            };
        });

        const wsLinks = XLSX.utils.json_to_sheet(linksData);
        wsLinks['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 25 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, wsLinks, "Links");

        const annotationsData = validNodes
            .filter(n => n.type !== 'custom')
            .map(n => ({
                Type: n.type === 'group' ? 'Group' : 'Text',
                Content: n.type === 'group' ? n.data.label : n.data.text,
                X: Math.round(n.position.x),
                Y: Math.round(n.position.y)
            }));

        if (annotationsData.length > 0) {
            const wsAnnotations = XLSX.utils.json_to_sheet(annotationsData);
            wsAnnotations['!cols'] = [{ wch: 10 }, { wch: 40 }, { wch: 10 }, { wch: 10 }];
            XLSX.utils.book_append_sheet(wb, wsAnnotations, "Annotations");
        }

        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
        saveAs(blob, `${sanitizeFilename(mapName)}.xlsx`);

    } catch (error) {
        console.error("Failed to export to Excel:", error);
    }
};

export const importMapConfig = (file) => {
    return new Promise((resolve, reject) => {
        if (!file) return reject(new Error('No file provided.'));
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges) || typeof data.mapName !== 'string') {
                    throw new Error('Invalid or corrupted map configuration file.');
                }
                resolve({ nodes: data.nodes, edges: data.edges, mapName: data.mapName });
            } catch (error) {
                reject(new Error('Invalid or corrupted map configuration file.'));
            }
        };
        reader.readAsText(file);
    });
};
