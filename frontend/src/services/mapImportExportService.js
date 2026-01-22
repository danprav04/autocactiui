// frontend/src/services/mapImportExportService.js
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { NODE_WIDTH, NODE_HEIGHT } from '../config/constants';

// --- UTILITIES ---

const sanitizeFilename = (name) => (name || 'map').replace(/[^a-z0-9]/gi, '_').toLowerCase();
const escapeXml = (unsafe) => unsafe ? unsafe.replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;' }[c])) : '';

// Helper to generate a random GUID for Visio uniqueness
const generateGuid = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const cell = (n, v, u) => `<Cell N="${n}" V="${v}"${u ? ` U="${u}"` : ''}/>`;

// --- MAIN EXPORTS ---

/**
 * Creates a JSON blob from the current map state and triggers a download.
 */
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

/**
 * Exports the map data to an Excel file (.xlsx).
 */
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

// --- VISIO EXPORT LOGIC ---

// Helper to determine Master ID based on node type
const getMasterId = (node) => {
    if (node.type === 'group') return 4;
    if (node.type === 'text') return 5;
    
    // Custom Device Types
    const iconType = node.data?.iconType || '';
    if (iconType === 'Router') return 1;
    if (iconType === 'Switch') return 2;
    if (iconType === 'Firewall') return 6;
    if (iconType === 'Encryptor') return 2; 
    
    return 2; // Default to Switch/Box
};

export const exportToVisio = async (nodes, edges, mapName) => {
    try {
        const zip = new JSZip();
        
        // Filter and sort nodes (Groups lowest Z, Devices highest)
        const validNodes = nodes
            .filter(n => !n.data?.isPreview)
            .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
            
        const validEdges = edges.filter(e => !e.data?.isPreview);
        const now = new Date().toISOString();

        // --- 1. Calculate Bounds ---
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        if (validNodes.length === 0) {
            minX = 0; minY = 0; maxX = 1000; maxY = 1000;
        } else {
            validNodes.forEach(n => {
                const w = n.type === 'group' ? n.data.width : (n.width || NODE_WIDTH);
                const h = n.type === 'group' ? n.data.height : (n.height || NODE_HEIGHT);
                if (n.position.x < minX) minX = n.position.x;
                if (n.position.y < minY) minY = n.position.y;
                if (n.position.x + w > maxX) maxX = n.position.x + w;
                if (n.position.y + h > maxY) maxY = n.position.y + h;
            });
        }

        const PX_TO_INCH = 1 / 96;
        const MARGIN_INCHES = 0.5;
        
        const contentWidthPx = maxX - minX;
        const contentHeightPx = maxY - minY;
        
        const pageW = Math.max((contentWidthPx * PX_TO_INCH) + (MARGIN_INCHES * 2), 11);
        const pageH = Math.max((contentHeightPx * PX_TO_INCH) + (MARGIN_INCHES * 2), 8.5);

        // --- 2. Build ZIP Structure ---

        // [Content_Types].xml
        zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/visio/document.xml" ContentType="application/vnd.ms-visio.drawing.main+xml"/>
    <Override PartName="/visio/pages/pages.xml" ContentType="application/vnd.ms-visio.pages+xml"/>
    <Override PartName="/visio/pages/page1.xml" ContentType="application/vnd.ms-visio.page+xml"/>
    <Override PartName="/visio/masters/masters.xml" ContentType="application/vnd.ms-visio.masters+xml"/>
    <Override PartName="/visio/masters/master1.xml" ContentType="application/vnd.ms-visio.master+xml"/>
    <Override PartName="/visio/masters/master2.xml" ContentType="application/vnd.ms-visio.master+xml"/>
    <Override PartName="/visio/masters/master3.xml" ContentType="application/vnd.ms-visio.master+xml"/>
    <Override PartName="/visio/masters/master4.xml" ContentType="application/vnd.ms-visio.master+xml"/>
    <Override PartName="/visio/masters/master5.xml" ContentType="application/vnd.ms-visio.master+xml"/>
    <Override PartName="/visio/masters/master6.xml" ContentType="application/vnd.ms-visio.master+xml"/>
    <Override PartName="/visio/windows.xml" ContentType="application/vnd.ms-visio.windows+xml"/>
    <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
    <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`);

        // _rels/.rels
        zip.folder("_rels").file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/document" Target="visio/document.xml"/>
    <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
    <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);

        // visio/document.xml
        zip.folder("visio").file("document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<VisioDocument xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xml:lang="en-US">
    <DocumentSettings>
        <DefaultTextStyle>0</DefaultTextStyle>
        <DefaultLineStyle>0</DefaultLineStyle>
        <DefaultFillStyle>0</DefaultFillStyle>
        <DefaultGuideStyle>0</DefaultGuideStyle>
    </DocumentSettings>
    <Colors>
        <ColorEntry IX="0" RGB="#000000"/>
        <ColorEntry IX="1" RGB="#FFFFFF"/>
        <ColorEntry IX="2" RGB="#007bff"/>
        <ColorEntry IX="3" RGB="#dc3545"/>
        <ColorEntry IX="4" RGB="#f8f9fa"/>
        <ColorEntry IX="5" RGB="#28a745"/>
    </Colors>
    <FaceNames>
        <FaceName ID="0" Name="Arial" CharSets="0"/>
    </FaceNames>
    <StyleSheets>
        <StyleSheet ID="0" Name="No Style" NameU="No Style">
            <StyleProp><EnableLine>1</EnableLine><EnableFill>1</EnableFill><EnableText>1</EnableText></StyleProp>
        </StyleSheet>
    </StyleSheets>
</VisioDocument>`);

        // visio/_rels/document.xml.rels
        zip.folder("visio").folder("_rels").file("document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.microsoft.com/office/visio/2012/relationships/pages" Target="pages/pages.xml"/>
    <Relationship Id="rId2" Type="http://schemas.microsoft.com/office/visio/2012/relationships/masters" Target="masters/masters.xml"/>
    <Relationship Id="rId3" Type="http://schemas.microsoft.com/office/visio/2012/relationships/windows" Target="windows.xml"/>
</Relationships>`);

        // visio/windows.xml
        zip.folder("visio").file("windows.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Windows xmlns="http://schemas.microsoft.com/office/visio/2012/main">
    <Window ID="0" WindowType="Drawing" WindowState="1073741824" ViewScale="1" ViewCenterX="${pageW/2}" ViewCenterY="${pageH/2}">
        <ShowRulers>1</ShowRulers>
        <ShowGrid>1</ShowGrid>
    </Window>
</Windows>`);

        // visio/pages/pages.xml
        zip.folder("visio").folder("pages").file("pages.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Pages xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
    <Page ID="0" Name="Network Map" ViewScale="1" ViewCenterX="${pageW/2}" ViewCenterY="${pageH/2}">
        <PageSheet LineStyle="0" FillStyle="0" TextStyle="0">
            ${cell('PageWidth', pageW)}
            ${cell('PageHeight', pageH)}
            ${cell('DrawingScale', '1', 'IN')}
            ${cell('PageScale', '1', 'IN')}
            ${cell('DrawingScaleType', '0')}
            ${cell('DrawingSizeType', '0')}
            ${cell('InhibitSnap', '0')}
        </PageSheet>
        <Rel r:id="rId1"/>
    </Page>
</Pages>`);

        // visio/pages/_rels/pages.xml.rels
        zip.folder("visio").folder("pages").folder("_rels").file("pages.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.microsoft.com/office/visio/2012/relationships/page" Target="page1.xml"/>
</Relationships>`);

        // visio/masters/masters.xml
        // Using unique GUIDs to prevent caching issues in viewers
        zip.folder("visio").folder("masters").file("masters.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Masters xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
    <Master ID="1" NameU="Router" Name="Router" UniqueID="{${generateGuid()}}"><Rel r:id="rId1"/></Master>
    <Master ID="2" NameU="Switch" Name="Switch" UniqueID="{${generateGuid()}}"><Rel r:id="rId2"/></Master>
    <Master ID="3" NameU="Connector" Name="Connector" UniqueID="{${generateGuid()}}"><Rel r:id="rId3"/></Master>
    <Master ID="4" NameU="Group" Name="Group" UniqueID="{${generateGuid()}}"><Rel r:id="rId4"/></Master>
    <Master ID="5" NameU="Text" Name="Text" UniqueID="{${generateGuid()}}"><Rel r:id="rId5"/></Master>
    <Master ID="6" NameU="Firewall" Name="Firewall" UniqueID="{${generateGuid()}}"><Rel r:id="rId6"/></Master>
</Masters>`);

        // visio/masters/_rels/masters.xml.rels
        zip.folder("visio").folder("masters").folder("_rels").file("masters.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.microsoft.com/office/visio/2012/relationships/master" Target="master1.xml"/>
    <Relationship Id="rId2" Type="http://schemas.microsoft.com/office/visio/2012/relationships/master" Target="master2.xml"/>
    <Relationship Id="rId3" Type="http://schemas.microsoft.com/office/visio/2012/relationships/master" Target="master3.xml"/>
    <Relationship Id="rId4" Type="http://schemas.microsoft.com/office/visio/2012/relationships/master" Target="master4.xml"/>
    <Relationship Id="rId5" Type="http://schemas.microsoft.com/office/visio/2012/relationships/master" Target="master5.xml"/>
    <Relationship Id="rId6" Type="http://schemas.microsoft.com/office/visio/2012/relationships/master" Target="master6.xml"/>
</Relationships>`);

        // --- MASTER DEFINITIONS (FIXED ObjType) ---

        // Master 1: Router (Circle)
        zip.folder("visio").folder("masters").file("master1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<MasterContents xmlns="http://schemas.microsoft.com/office/visio/2012/main">
    <Shapes>
        <Shape ID="1" Type="Shape" LineStyle="0" FillStyle="0" TextStyle="0">
            <XForm>${cell('PinX', '0.5')}${cell('PinY', '0.5')}${cell('Width', '1')}${cell('Height', '1')}</XForm>
            <ObjType>1</ObjType>
            <Line>${cell('LineWeight', '0.02', 'IN')}${cell('LineColor', '2')}${cell('LinePattern', '1')}</Line>
            <Fill>${cell('FillForegnd', '1')}${cell('FillPattern', '1')}</Fill>
            <Geom IX="0">
                <Ellipse IX="1">
                    ${cell('X', '0.5')}${cell('Y', '0.5')}${cell('A', '1')}${cell('B', '0.5')}${cell('C', '0.5')}${cell('D', '1')}
                </Ellipse>
            </Geom>
            <Char IX="0">${cell('Font', '0')}${cell('Size', '0.12', 'PT')}</Char>
        </Shape>
    </Shapes>
</MasterContents>`);

        // Master 2: Switch (Rectangle)
        zip.folder("visio").folder("masters").file("master2.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<MasterContents xmlns="http://schemas.microsoft.com/office/visio/2012/main">
    <Shapes>
        <Shape ID="2" Type="Shape" LineStyle="0" FillStyle="0" TextStyle="0">
            <XForm>${cell('PinX', '0.5')}${cell('PinY', '0.375')}${cell('Width', '1')}${cell('Height', '0.75')}</XForm>
            <ObjType>1</ObjType>
            <Line>${cell('LineWeight', '0.02', 'IN')}${cell('LineColor', '0')}${cell('LinePattern', '1')}</Line>
            <Fill>${cell('FillForegnd', '1')}${cell('FillPattern', '1')}</Fill>
            <Geom IX="0">
                <MoveTo IX="1">${cell('X', '0')}${cell('Y', '0')}</MoveTo>
                <LineTo IX="2">${cell('X', '1')}${cell('Y', '0')}</LineTo>
                <LineTo IX="3">${cell('X', '1')}${cell('Y', '0.75')}</LineTo>
                <LineTo IX="4">${cell('X', '0')}${cell('Y', '0.75')}</LineTo>
                <LineTo IX="5">${cell('X', '0')}${cell('Y', '0')}</LineTo>
            </Geom>
            <Char IX="0">${cell('Font', '0')}${cell('Size', '0.12', 'PT')}</Char>
        </Shape>
    </Shapes>
</MasterContents>`);

        // Master 3: Connector (RESTORED ObjType=2)
        zip.folder("visio").folder("masters").file("master3.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<MasterContents xmlns="http://schemas.microsoft.com/office/visio/2012/main">
    <Shapes>
        <Shape ID="3" Type="Shape" LineStyle="0" FillStyle="0" TextStyle="0">
            <XForm1D>${cell('BeginX', '0')}${cell('BeginY', '0')}${cell('EndX', '1')}${cell('EndY', '0')}</XForm1D>
            <ObjType>2</ObjType>
            <Line>${cell('LineWeight', '0.02', 'IN')}${cell('LineColor', '5')}${cell('EndArrow', '2')}</Line>
            <Char IX="0">${cell('Size', '0.10', 'PT')}</Char>
        </Shape>
    </Shapes>
</MasterContents>`);

        // Master 4: Group
        zip.folder("visio").folder("masters").file("master4.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<MasterContents xmlns="http://schemas.microsoft.com/office/visio/2012/main">
    <Shapes>
        <Shape ID="4" Type="Group" LineStyle="0" FillStyle="0" TextStyle="0">
            <XForm>${cell('PinX', '0.5')}${cell('PinY', '0.5')}${cell('Width', '1')}${cell('Height', '1')}</XForm>
            <ObjType>1</ObjType>
            <Line>${cell('LineWeight', '0.01', 'IN')}${cell('LineColor', '0')}${cell('LinePattern', '2')}</Line>
            <Fill>${cell('FillForegnd', '4')}${cell('FillPattern', '1')}</Fill>
            <Geom IX="0">
                <MoveTo IX="1">${cell('X', '0')}${cell('Y', '0')}</MoveTo>
                <LineTo IX="2">${cell('X', '1')}${cell('Y', '0')}</LineTo>
                <LineTo IX="3">${cell('X', '1')}${cell('Y', '1')}</LineTo>
                <LineTo IX="4">${cell('X', '0')}${cell('Y', '1')}</LineTo>
                <LineTo IX="5">${cell('X', '0')}${cell('Y', '0')}</LineTo>
            </Geom>
            <Char IX="0">${cell('Size', '0.12', 'PT')}</Char>
        </Shape>
    </Shapes>
</MasterContents>`);

        // Master 5: Text
        zip.folder("visio").folder("masters").file("master5.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<MasterContents xmlns="http://schemas.microsoft.com/office/visio/2012/main">
    <Shapes>
        <Shape ID="5" Type="Shape" LineStyle="0" FillStyle="0" TextStyle="0">
            <XForm>${cell('PinX', '0.5')}${cell('PinY', '0.25')}${cell('Width', '1')}${cell('Height', '0.5')}</XForm>
            <ObjType>1</ObjType>
            <Line>${cell('LinePattern', '0')}</Line>
            <Fill>${cell('FillPattern', '0')}</Fill>
            <Char IX="0">${cell('Size', '0.12', 'PT')}</Char>
        </Shape>
    </Shapes>
</MasterContents>`);

        // Master 6: Firewall
        zip.folder("visio").folder("masters").file("master6.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<MasterContents xmlns="http://schemas.microsoft.com/office/visio/2012/main">
    <Shapes>
        <Shape ID="6" Type="Shape" LineStyle="0" FillStyle="0" TextStyle="0">
            <XForm>${cell('PinX', '0.5')}${cell('PinY', '0.5')}${cell('Width', '1')}${cell('Height', '1')}</XForm>
            <ObjType>1</ObjType>
            <Line>${cell('LineWeight', '0.03', 'IN')}${cell('LineColor', '3')}${cell('LinePattern', '1')}</Line>
            <Fill>${cell('FillForegnd', '1')}${cell('FillPattern', '1')}</Fill>
            <Geom IX="0">
                <MoveTo IX="1">${cell('X', '0')}${cell('Y', '0')}</MoveTo>
                <LineTo IX="2">${cell('X', '1')}${cell('Y', '0')}</LineTo>
                <LineTo IX="3">${cell('X', '1')}${cell('Y', '1')}</LineTo>
                <LineTo IX="4">${cell('X', '0')}${cell('Y', '1')}</LineTo>
                <LineTo IX="5">${cell('X', '0')}${cell('Y', '0')}</LineTo>
            </Geom>
            <Char IX="0">${cell('Size', '0.12', 'PT')}</Char>
        </Shape>
    </Shapes>
</MasterContents>`);

        // --- 3. GENERATE PAGE CONTENT ---
        let shapesXml = '';
        let connectsXml = '';
        const nodeMap = new Map();
        let shapeIdCounter = 100;

        validNodes.forEach(node => {
            const visioId = shapeIdCounter++;
            nodeMap.set(node.id, visioId);
            const masterId = getMasterId(node);
            
            const wPx = node.type === 'group' ? node.data.width : (node.width || NODE_WIDTH);
            const hPx = node.type === 'group' ? node.data.height : (node.height || NODE_HEIGHT);
            
            const wInch = wPx * PX_TO_INCH;
            const hInch = hPx * PX_TO_INCH;
            
            // Flip Y axis: Visio (0,0) is bottom-left, data is top-left
            const pinX = MARGIN_INCHES + (node.position.x - minX) * PX_TO_INCH + (wInch / 2);
            const pinY = pageH - MARGIN_INCHES - (node.position.y - minY) * PX_TO_INCH - (hInch / 2);

            let label = node.type === 'custom' ? (node.data.hostname || 'Device') : (node.data.label || node.data.text || 'Group');
            let ip = node.data.ip || '';
            const textBlock = ip ? `${label}\n${ip}` : label;
            
            // Minimal Shape Definition (inherit most from Master)
            shapesXml += `<Shape ID="${visioId}" Type="Shape" Master="${masterId}">
                <XForm>
                    ${cell('PinX', pinX)}
                    ${cell('PinY', pinY)}
                    ${cell('Width', wInch)}
                    ${cell('Height', hInch)}
                    ${cell('LocPinX', wInch/2)}
                    ${cell('LocPinY', hInch/2)}
                </XForm>
                <Text>${escapeXml(textBlock)}</Text>
            </Shape>`;
        });

        validEdges.forEach(edge => {
            const srcId = nodeMap.get(edge.source);
            const tgtId = nodeMap.get(edge.target);
            if (srcId && tgtId) {
                const connId = shapeIdCounter++;
                const iface = edge.data?.interface || '';
                const bw = edge.data?.bandwidth || '';
                const lbl = [iface, bw].filter(Boolean).join(' - ');

                // Connectors are 1D shapes
                shapesXml += `<Shape ID="${connId}" Type="Shape" Master="3">
                    <XForm1D>
                        ${cell('BeginX', '0')}
                        ${cell('BeginY', '0')}
                        ${cell('EndX', '0')}
                        ${cell('EndY', '0')}
                    </XForm1D>
                    ${lbl ? `<Text>${escapeXml(lbl)}</Text>` : ''}
                </Shape>`;
                
                // Using standard dynamic connector logic
                connectsXml += `<Connect FromSheet="${connId}" FromCell="BeginX" FromPart="9" ToSheet="${srcId}" ToCell="PinX" ToPart="3"/>`;
                connectsXml += `<Connect FromSheet="${connId}" FromCell="EndX" FromPart="12" ToSheet="${tgtId}" ToCell="PinX" ToPart="3"/>`;
            }
        });

        const page1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
    <Shapes>${shapesXml}</Shapes>
    <Connects>${connectsXml}</Connects>
</PageContents>`;

        zip.folder("visio").folder("pages").file("page1.xml", page1Xml);

        // docProps
        zip.folder("docProps").file("core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <dc:title>${escapeXml(mapName)}</dc:title>
    <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
</cp:coreProperties>`);
        zip.folder("docProps").file("app.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
    <Application>AutoCacti</Application>
</Properties>`);

        const blob = await zip.generateAsync({ type: "blob" });
        saveAs(blob, `${sanitizeFilename(mapName)}.vsdx`);

    } catch (error) {
        console.error("Failed to export to VSDX:", error);
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