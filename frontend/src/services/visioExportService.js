// frontend/src/services/visioExportService.js
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// --- XML Templates ---

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/visio/document.xml" ContentType="application/vnd.ms-visio.drawing.main+xml"/>
  <Override PartName="/visio/pages/pages.xml" ContentType="application/vnd.ms-visio.pages+xml"/>
  <Override PartName="/visio/pages/page1.xml" ContentType="application/vnd.ms-visio.page+xml"/>
  <Override PartName="/visio/masters/masters.xml" ContentType="application/vnd.ms-visio.masters+xml"/>
  <Override PartName="/visio/masters/master1.xml" ContentType="application/vnd.ms-visio.master+xml"/>
  <Override PartName="/visio/masters/master2.xml" ContentType="application/vnd.ms-visio.master+xml"/>
</Types>`;

const RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/document" Target="visio/document.xml"/>
</Relationships>`;

const DOCUMENT_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<VisioDocument xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <DocumentSettings TopPage="0" DefaultTextStyle="0" DefaultLineStyle="0" DefaultFillStyle="0"/>
  <Colors/>
  <FaceNames/>
  <StyleSheets/>
  <DocumentSheet/>
</VisioDocument>`;

const DOCUMENT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/pages" Target="pages/pages.xml"/>
  <Relationship Id="rId2" Type="http://schemas.microsoft.com/visio/2010/relationships/masters" Target="masters/masters.xml"/>
</Relationships>`;

const PAGES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Pages xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <Page ID="0" Name="Page-1" NameU="Page-1">
    <PageSheet/>
    <r:Rel r:id="rId1"/>
  </Page>
</Pages>`;

const PAGES_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page1.xml"/>
</Relationships>`;

const MASTERS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Masters xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <Master ID="0" UniqueID="{00000000-0000-0000-0000-000000000001}" Name="Rectangle" NameU="Rectangle" IconSize="1" PatternFlags="0" Prompt="" Hidden="0" IconUpdate="1" AlignName="2" MatchByName="0">
    <r:Rel r:id="rId1"/>
  </Master>
  <Master ID="1" UniqueID="{00000000-0000-0000-0000-000000000002}" Name="Dynamic connector" NameU="Dynamic connector" IconSize="1" PatternFlags="0" Prompt="" Hidden="0" IconUpdate="1" AlignName="2" MatchByName="0">
    <r:Rel r:id="rId2"/>
  </Master>
</Masters>`;

const MASTERS_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/master" Target="master1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.microsoft.com/visio/2010/relationships/master" Target="master2.xml"/>
</Relationships>`;

const MASTER1_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<MasterContents xmlns="http://schemas.microsoft.com/office/visio/2012/main">
  <Shapes>
    <Shape ID="1" Type="Shape" Master="0">
      <Cell N="Width" V="1"/>
      <Cell N="Height" V="0.5"/>
      <Cell N="PinX" V="0.5"/>
      <Cell N="PinY" V="0.25"/>
      <Cell N="FillForegnd" V="#4472C4"/>
      <Cell N="LineWeight" V="0.01"/>
      <Section N="Geometry1">
        <Row T="RelMoveTo"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>
        <Row T="RelLineTo"><Cell N="X" V="1"/><Cell N="Y" V="0"/></Row>
        <Row T="RelLineTo"><Cell N="X" V="1"/><Cell N="Y" V="1"/></Row>
        <Row T="RelLineTo"><Cell N="X" V="0"/><Cell N="Y" V="1"/></Row>
        <Row T="RelLineTo"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>
      </Section>
    </Shape>
  </Shapes>
</MasterContents>`;

const MASTER2_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<MasterContents xmlns="http://schemas.microsoft.com/office/visio/2012/main">
  <Shapes>
    <Shape ID="1" Type="Shape" Master="1">
      <Cell N="BeginX" V="0"/>
      <Cell N="BeginY" V="0"/>
      <Cell N="EndX" V="1"/>
      <Cell N="EndY" V="0"/>
      <Cell N="LineWeight" V="0.01"/>
      <Section N="Geometry1">
        <Row T="MoveTo"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>
        <Row T="LineTo"><Cell N="X" V="1"/><Cell N="Y" V="0"/></Row>
      </Section>
    </Shape>
  </Shapes>
</MasterContents>`;

// --- Helper Functions ---

const sanitizeFilename = (name) => (name || 'map').replace(/[^a-z0-9]/gi, '_').toLowerCase();

const escapeXml = (str) => {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
};

// Convert pixels to Visio inches (approximate - 96 DPI)
const pxToInches = (px) => px / 96;

/**
 * Generates the page1.xml content with all shapes (nodes) and connectors (edges).
 * @param {Array} nodes - The map nodes.
 * @param {Array} edges - The map edges.
 * @returns {string} The XML content for page1.xml.
 */
const generatePage1Xml = (nodes, edges) => {
    const validNodes = nodes.filter(n => n.type === 'custom' && !n.data?.isPreview);
    const validEdges = edges.filter(e => !e.data?.isPreview);

    // Create a map for quick node lookup
    const nodeMap = new Map(validNodes.map(n => [n.id, n]));

    let shapeId = 1;
    const shapes = [];

    // Generate node shapes
    validNodes.forEach(node => {
        const x = pxToInches(node.position.x + 75); // Center of 150px wide node
        const y = pxToInches(1000 - node.position.y - 40); // Flip Y axis, center of 80px tall node
        const width = pxToInches(150);
        const height = pxToInches(80);

        const hostname = escapeXml(node.data.hostname || 'Unknown');
        const ip = escapeXml(node.data.ip || 'N/A');
        const deviceType = escapeXml(node.data.iconType || 'Device');
        const label = `${hostname}\n${ip}\n[${deviceType}]`;

        shapes.push(`
    <Shape ID="${shapeId}" Type="Shape" Master="0" UniqueID="{${generateUUID()}}">
      <Cell N="PinX" V="${x.toFixed(4)}"/>
      <Cell N="PinY" V="${y.toFixed(4)}"/>
      <Cell N="Width" V="${width.toFixed(4)}"/>
      <Cell N="Height" V="${height.toFixed(4)}"/>
      <Cell N="LocPinX" V="${(width / 2).toFixed(4)}"/>
      <Cell N="LocPinY" V="${(height / 2).toFixed(4)}"/>
      <Cell N="FillForegnd" V="#4472C4"/>
      <Cell N="Char.Size" V="0.1111"/>
      <Section N="Geometry1">
        <Row T="RelMoveTo"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>
        <Row T="RelLineTo"><Cell N="X" V="1"/><Cell N="Y" V="0"/></Row>
        <Row T="RelLineTo"><Cell N="X" V="1"/><Cell N="Y" V="1"/></Row>
        <Row T="RelLineTo"><Cell N="X" V="0"/><Cell N="Y" V="1"/></Row>
        <Row T="RelLineTo"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>
      </Section>
      <Text>${label}</Text>
    </Shape>`);

        shapeId++;
    });

    // Generate edge connectors
    validEdges.forEach(edge => {
        const sourceNode = nodeMap.get(edge.source);
        const targetNode = nodeMap.get(edge.target);

        if (!sourceNode || !targetNode) return;

        const beginX = pxToInches(sourceNode.position.x + 75);
        const beginY = pxToInches(1000 - sourceNode.position.y - 40);
        const endX = pxToInches(targetNode.position.x + 75);
        const endY = pxToInches(1000 - targetNode.position.y - 40);

        const interfaceName = escapeXml(edge.data?.interface || 'N/A');
        const bandwidth = escapeXml(edge.data?.bandwidth || 'N/A');
        const sourceHostname = escapeXml(sourceNode.data.hostname || edge.source);
        const targetHostname = escapeXml(targetNode.data.hostname || edge.target);
        const label = `${interfaceName}\n${bandwidth}`;

        shapes.push(`
    <Shape ID="${shapeId}" Type="Shape" Master="1" UniqueID="{${generateUUID()}}">
      <Cell N="BeginX" V="${beginX.toFixed(4)}"/>
      <Cell N="BeginY" V="${beginY.toFixed(4)}"/>
      <Cell N="EndX" V="${endX.toFixed(4)}"/>
      <Cell N="EndY" V="${endY.toFixed(4)}"/>
      <Cell N="LineWeight" V="0.02"/>
      <Cell N="Char.Size" V="0.0833"/>
      <Section N="Geometry1">
        <Row T="MoveTo"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>
        <Row T="LineTo"><Cell N="X" V="${(endX - beginX).toFixed(4)}"/><Cell N="Y" V="${(endY - beginY).toFixed(4)}"/></Row>
      </Section>
      <Section N="User">
        <Row N="SourceDevice"><Cell N="Value" V="${sourceHostname}"/></Row>
        <Row N="TargetDevice"><Cell N="Value" V="${targetHostname}"/></Row>
        <Row N="Interface"><Cell N="Value" V="${interfaceName}"/></Row>
        <Row N="Bandwidth"><Cell N="Value" V="${bandwidth}"/></Row>
      </Section>
      <Text>${label}</Text>
    </Shape>`);

        shapeId++;
    });

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main">
  <Shapes>
    ${shapes.join('\n')}
  </Shapes>
</PageContents>`;
};

/**
 * Generates a simple UUID for unique shape IDs.
 */
const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : ((r & 0x3) | 0x8);
        return v.toString(16);
    });
};

// --- Main Export Function ---

/**
 * Exports the map data to a Visio (.vsdx) file.
 * @param {Array} nodes - The map nodes.
 * @param {Array} edges - The map edges.
 * @param {string} mapName - The name for the exported file.
 */
export const exportToVisio = async (nodes, edges, mapName) => {
    try {
        const zip = new JSZip();

        // Add root files
        zip.file('[Content_Types].xml', CONTENT_TYPES_XML);
        zip.file('_rels/.rels', RELS_XML);

        // Add visio folder structure
        zip.file('visio/document.xml', DOCUMENT_XML);
        zip.file('visio/_rels/document.xml.rels', DOCUMENT_RELS_XML);

        // Add pages
        zip.file('visio/pages/pages.xml', PAGES_XML);
        zip.file('visio/pages/_rels/pages.xml.rels', PAGES_RELS_XML);
        zip.file('visio/pages/page1.xml', generatePage1Xml(nodes, edges));

        // Add masters
        zip.file('visio/masters/masters.xml', MASTERS_XML);
        zip.file('visio/masters/_rels/masters.xml.rels', MASTERS_RELS_XML);
        zip.file('visio/masters/master1.xml', MASTER1_XML);
        zip.file('visio/masters/master2.xml', MASTER2_XML);

        // Generate the VSDX file
        const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.ms-visio.drawing' });
        saveAs(blob, `${sanitizeFilename(mapName)}.vsdx`);

    } catch (error) {
        console.error('Failed to export to Visio:', error);
        throw error;
    }
};
