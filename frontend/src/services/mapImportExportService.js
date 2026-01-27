import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// --- UTILITIES ---

const sanitizeFilename = (name) => (name || 'map').replace(/[^a-z0-9]/gi, '_').toLowerCase();

// --- MAIN EXPORTS ---

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

export const exportToDrawio = (nodes, edges, mapName) => {
    try {
        const mxGraphModel = generateDrawioXml(nodes, edges);
        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="Electron" modified="${new Date().toISOString()}" agent="AutoCactiUI" version="21.0.0" type="device">
  <diagram id="autocacti-diagram" name="Page-1">
    ${mxGraphModel}
  </diagram>
</mxfile>`;

        const blob = new Blob([xmlContent], { type: 'application/xml' });
        saveAs(blob, `${sanitizeFilename(mapName)}.drawio`);
    } catch (error) {
        console.error("Failed to export to Draw.io:", error);
    }
};

const generateDrawioXml = (nodes, edges) => {
    let xml = '<mxGraphModel dx="1422" dy="794" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" math="0" shadow="0">\n';
    xml += '      <root>\n';
    xml += '        <mxCell id="0" />\n';
    xml += '        <mxCell id="1" parent="0" />\n';

    // Helper for escaping XML
    const escape = (str) => {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    };

    // Helper to get style based on node type - Improved Aesthetics
    const getStyle = (node) => {
        if (node.type === 'custom') {
            const iconType = node.data.iconType || 'Router';
            // Cisco-like styles but cleaner
            const common = 'html=1;pointerEvents=1;dashed=0;strokeColor=none;verticalLabelPosition=bottom;verticalAlign=top;align=center;outlineConnect=0;';
            switch (iconType) {
                case 'Router': return `shape=mxgraph.cisco.routers.router;${common}fillColor=#005073;`;
                case 'Switch': return `shape=mxgraph.cisco.switches.layer_2_remote_switch;${common}fillColor=#005073;`;
                case 'Firewall': return `shape=mxgraph.cisco.security.firewall_asm;${common}fillColor=#005073;`;
                case 'Server': return `shape=mxgraph.cisco.servers.server;${common}fillColor=#005073;`;
                case 'Cloud': return 'ellipse;shape=cloud;whiteSpace=wrap;html=1;fillColor=#DAE8FC;strokeColor=#6C8EBF;';
                default: return 'shape=rect;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#666666;fontColor=#333333;rounded=1;';
            }
        } else if (node.type === 'group') {
            // Cleaner group style
            return 'group;html=1;dashed=1;dashPattern=1 2;opacity=70;fillColor=#F1F3F4;strokeColor=#9AA0A6;rounded=1;arcSize=10;';
        } else if (node.type === 'text') {
            return 'text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fontStyle=1;fontSize=14;';
        }
        return '';
    };

    // 1. Calculate Bounding Box and Centering Offsets
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodes.forEach(node => {
        const x = node.position.x;
        const y = node.position.y;
        const w = node.data?.width || node.width || 80;
        const h = node.data?.height || node.height || 80;
        if (x < minX) minX = x;
        if (x + w > maxX) maxX = x + w;
        if (y < minY) minY = y;
        if (y + h > maxY) maxY = y + h;
    });

    // Check if we have valid nodes
    if (minX === Infinity) { minX = 0; maxX = 0; minY = 0; maxY = 0; }

    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;

    // Draw.io default page format (US Letter) is roughly 850x1100
    const pageCenterX = 850 / 2;
    const pageCenterY = 1100 / 2;

    const offsetX = pageCenterX - contentCenterX;
    const offsetY = pageCenterY - contentCenterY;

    // Sort nodes (Groups first)
    const sortedNodes = [...nodes].sort((a, b) => {
        if (a.type === 'group' && b.type !== 'group') return -1;
        if (a.type !== 'group' && b.type === 'group') return 1;
        return 0;
    });

    sortedNodes.forEach(node => {
        const id = escape(node.id);
        // Apply centering offset
        const x = Math.round(node.position.x + offsetX);
        const y = Math.round(node.position.y + offsetY);

        const width = node.data?.width || node.width || 80;
        const height = node.data?.height || node.height || 80;

        const style = getStyle(node);

        let value = '';
        if (node.type === 'custom') {
            value = escape(node.data.hostname || node.id);
        } else if (node.type === 'group') {
            value = escape(node.data.label || 'Group');
        } else if (node.type === 'text') {
            value = escape(node.data.text || 'Text');
        }

        xml += `        <mxCell id="${id}" value="${value}" style="${style}" vertex="1" parent="1">\n`;
        xml += `          <mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry" />\n`;
        xml += `        </mxCell>\n`;
    });

    // 2. Handle Multiple Edges (Parallel Lines)
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Group edges by pair (sorted IDs ensures A-B and B-A are treated as same pair)
    const edgeGroups = {};
    edges.forEach(edge => {
        const pairId = [edge.source, edge.target].sort().join('-');
        if (!edgeGroups[pairId]) edgeGroups[pairId] = [];
        edgeGroups[pairId].push(edge);
    });

    Object.values(edgeGroups).forEach(group => {
        const count = group.length;
        group.forEach((edge, index) => {
            const id = escape(edge.id);
            const source = escape(edge.source);
            const target = escape(edge.target);

            // Base style
            let style = "endArrow=none;html=1;rounded=1;strokeWidth=2;strokeColor=#333333;";

            // Calculate spacing for parallel edges
            if (count > 1) {
                const sourceNode = nodeMap.get(edge.source);
                const targetNode = nodeMap.get(edge.target);

                if (sourceNode && targetNode) {
                    const dx = targetNode.position.x - sourceNode.position.x;
                    const dy = targetNode.position.y - sourceNode.position.y;

                    // Bundle Width: Tight grouping (0.2 width centered at 0.5)
                    // Start at 0.4, End at 0.6
                    const bundleWidth = 0.2;
                    const step = bundleWidth / (count + 1);
                    const position = 0.5 - (bundleWidth / 2) + (step * (index + 1));

                    if (Math.abs(dx) > Math.abs(dy)) {
                        // Horizontal Layout: Vary Y, Fix X
                        if (dx > 0) {
                            // Target is Right -> Source Exit Right (1), Target Entry Left (0)
                            style += `exitX=1;exitY=${position.toFixed(3)};entryX=0;entryY=${position.toFixed(3)};`;
                        } else {
                            // Target is Left -> Source Exit Left (0), Target Entry Right (1)
                            style += `exitX=0;exitY=${position.toFixed(3)};entryX=1;entryY=${position.toFixed(3)};`;
                        }
                    } else {
                        // Vertical Layout: Vary X, Fix Y
                        if (dy > 0) {
                            // Target is Below -> Source Exit Bottom (1), Target Entry Top (0)
                            style += `exitX=${position.toFixed(3)};exitY=1;entryX=${position.toFixed(3)};entryY=0;`;
                        } else {
                            // Target is Above -> Source Exit Top (0), Target Entry Bottom (1)
                            style += `exitX=${position.toFixed(3)};exitY=0;entryX=${position.toFixed(3)};entryY=1;`;
                        }
                    }
                }
            }

            xml += `        <mxCell id="${id}" value="" style="${style}" edge="1" parent="1" source="${source}" target="${target}">\n`;
            xml += `          <mxGeometry relative="1" as="geometry" />\n`;
            xml += `        </mxCell>\n`;
        });
    });

    xml += '      </root>\n';
    xml += '    </mxGraphModel>';
    return xml;
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
