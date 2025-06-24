// This logic is ported from the original Python codebase to generate a
// Cacti Weathermap-compatible configuration file using the provided template.

// Template for a Weathermap NODE to be inserted into the %nodes% section
const NODE_TEMPLATE = "NODE {id}\n\tLABEL {label}\n\tICON \n\tPOSITION {x} {y}";

// Template for a Weathermap LINK to be inserted into the %links% section
const LINK_TEMPLATE = "LINK {id1}-{id2}\n\tNODES {id1} {id2}";

// The complete base template for the .conf file, transcribed from your image.
// Placeholders %name%, %width%, %height%, %nodes%, and %links% will be replaced.
const CONFIG_TEMPLATE = `
BACKGROUND images/backgrounds/%name%.png
WIDTH %width%
HEIGHT %height%
TITLE %name%

KEYPOS DEFAULT -1 -1 Traffic Load
KEYTEXTCOLOR 0 0 0
KEYOUTLINECOLOR 0 0 0
KEYBGCOLOR 255 255 255
BGCOLOR 255 255 255
TITLECOLOR 0 0 0
TIMECOLOR 0 0 0
SCALE DEFAULT 0  0   192 192 192
SCALE DEFAULT 0  1   255 255 255
SCALE DEFAULT 1  10  140 0 255
SCALE DEFAULT 10 25  32 32 255
SCALE DEFAULT 25 40  0 192 255
SCALE DEFAULT 40 55  0 240 0
SCALE DEFAULT 55 70  240 240 0
SCALE DEFAULT 70 85  255 192 0
SCALE DEFAULT 85 100 255 0 0

SET key_hidezero_DEFAULT 1

# End of global section

# TEMPLATE-only NODEs:

# TEMPLATE-only LINKs:
LINK DEFAULT
    WIDTH 3
    BWLABEL bits
    BANDWIDTH 10000M

# regular NODEs:
%nodes%

# regular LINKs:
%links%

# That's All Folks!
`;

/**
 * Generates the content for a Cacti Weathermap .conf file.
 * @param {Array} nodes - The array of nodes from React Flow.
 * @param {Array} edges - The array of edges from React Flow.
 * @param {string} mapName - The name for the map.
 * @returns {string} The full content of the .conf file.
 */
export function generateCactiConfig(nodes, edges, mapName) {
  let nodeCounter = 1;
  const nodeStrings = [];
  const linkStrings = [];

  const nodeMap = new Map(nodes.map(node => [node.id, node]));

  for (const edge of edges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);

    if (!sourceNode || !targetNode) {
      continue;
    }
    
    const id1 = `NODE${String(nodeCounter).padStart(3, '0')}`;
    const id2 = `NODE${String(nodeCounter + 1).padStart(3, '0')}`;

    nodeStrings.push(
      NODE_TEMPLATE.replace('{id}', id1)
        .replace('{label}', sourceNode.data.hostname)
        .replace('{x}', Math.round(sourceNode.position.x))
        .replace('{y}', Math.round(sourceNode.position.y))
    );

    nodeStrings.push(
      NODE_TEMPLATE.replace('{id}', id2)
        .replace('{label}', targetNode.data.hostname)
        .replace('{x}', Math.round(targetNode.position.x))
        .replace('{y}', Math.round(targetNode.position.y))
    );

    // --- FIX IS HERE ---
    // Use a regular expression with the global 'g' flag to replace ALL occurrences.
    const populatedLink = LINK_TEMPLATE
        .replace(/{id1}/g, id1)
        .replace(/{id2}/g, id2);
    
    linkStrings.push(populatedLink);
    // --- END OF FIX ---

    nodeCounter += 2;
  }
  
  const allX = nodes.map(n => n.position.x);
  const allY = nodes.map(n => n.position.y);
  const mapWidth = nodes.length > 0 ? Math.round(Math.max(...allX) + 150) : 800;
  const mapHeight = nodes.length > 0 ? Math.round(Math.max(...allY) + 150) : 600;


  let finalConfig = CONFIG_TEMPLATE;
  finalConfig = finalConfig.replace(/%name%/g, mapName);
  finalConfig = finalConfig.replace('%width%', mapWidth);
  finalConfig = finalConfig.replace('%height%', mapHeight);
  finalConfig = finalConfig.replace('%nodes%', nodeStrings.join('\n'));
  finalConfig = finalConfig.replace('%links%', linkStrings.join('\n'));

  return finalConfig.trim();
}