// frontend/src/services/configGenerator.js
import { NODE_WIDTH, NODE_HEIGHT } from '../config/constants';

/**
 * A fixed horizontal offset (in pixels) to apply to all generated coordinates
 * after scaling. A positive value shifts the entire map to the right on the final PNG.
 */
const CONFIG_X_OFFSET = 0;

/**
 * A fixed vertical offset (in pixels) to apply to all generated coordinates
 * after scaling. A positive value shifts the entire map down on the final PNG.
 */
const CONFIG_Y_OFFSET = 0;


// Template for a Weathermap NODE used as an invisible anchor for a LINK.
const DUMMY_NODE_TEMPLATE = "NODE {id}\n\tPOSITION {x} {y}";

/**
 * Generates the content for a Cacti Weathermap .conf file.
 * @param {object} params - The parameters for config generation.
 * @returns {string} The full content of the .conf file.
 */
export function generateCactiConfig({ nodes, edges, mapName, mapWidth, mapHeight, scaleFactor, configTemplate }) {
  const deviceNodes = nodes.filter(node => node.type !== 'group');
  const nodeStrings = [];
  const linkStrings = [];

  const nodeInfoMap = new Map(deviceNodes.map(node => [node.id, node]));
  let nodeCounter = 1;

  // Group edges by the pair of nodes they connect (e.g., '10.10.1.2-10.10.1.3')
  const edgeGroups = new Map();
  for (const edge of edges) {
      // Create a sorted key to handle edges in either direction (A->B or B->A)
      const key = [edge.source, edge.target].sort().join('-');
      if (!edgeGroups.has(key)) {
          edgeGroups.set(key, []);
      }
      edgeGroups.get(key).push(edge);
  }

  // An offset to ensure link endpoints land safely inside the node's visual boundary.
  const LINK_ENDPOINT_OFFSET = 70;
  // The perpendicular distance between parallel links.
  const PARALLEL_LINK_OFFSET = 15;

  // Iterate through each group of edges (i.e., connections between two specific devices)
  for (const [key, edgeGroup] of edgeGroups.entries()) {
    
    // --- FIX FOR REDUNDANT LINKS ---
    // De-duplicate edges representing the same physical link from opposite ends.
    // A canonical direction is chosen by picking the node with the lexicographically
    // smaller ID as the source. To avoid losing data from asymmetric discovery,
    // we use the edge set (forward or reverse) that has more entries.
    const [nodeA_id, nodeB_id] = key.split('-'); // The key is sorted, so nodeA_id < nodeB_id

    const forwardEdges = edgeGroup.filter(e => e.source === nodeA_id);
    const reverseEdges = edgeGroup.filter(e => e.source === nodeB_id);
    
    // Use the direction that reported more links to avoid data loss.
    // If equal, prefer the canonical direction (forward).
    const edgesToProcess = forwardEdges.length >= reverseEdges.length ? forwardEdges : reverseEdges;
    // --- END OF FIX ---

    const totalEdgesInGroup = edgesToProcess.length;
    
    // Starting offset calculation ensures the links are centered around the true center line.
    let initialOffset = -PARALLEL_LINK_OFFSET * (totalEdgesInGroup - 1) / 2;

    for (let i = 0; i < totalEdgesInGroup; i++) {
      const edge = edgesToProcess[i];
      const sourceNodeInfo = nodeInfoMap.get(edge.source);
      const targetNodeInfo = nodeInfoMap.get(edge.target);

      if (!sourceNodeInfo || !targetNodeInfo) continue;

      // The link's vector should be based on the geometric center of the node component.
      const sourceCenterX = sourceNodeInfo.position.x + (NODE_WIDTH / 2);
      const sourceCenterY = sourceNodeInfo.position.y + (NODE_HEIGHT / 2);
      const targetCenterX = targetNodeInfo.position.x + (NODE_WIDTH / 2);
      const targetCenterY = targetNodeInfo.position.y + (NODE_HEIGHT / 2);

      const dx = targetCenterX - sourceCenterX;
      const dy = targetCenterY - sourceCenterY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance === 0) continue;

      // Create a unit vector (direction of the line)
      const ux = dx / distance;
      const uy = dy / distance;

      // Create a perpendicular unit vector for the offset
      const px = -uy;
      const py = ux;

      // Calculate the current offset for this specific link
      const currentOffset = initialOffset + i * PARALLEL_LINK_OFFSET;

      // Apply the perpendicular offset to the center points
      const offsetX = px * currentOffset;
      const offsetY = py * currentOffset;
      
      const offsetSourceCenterX = sourceCenterX + offsetX;
      const offsetSourceCenterY = sourceCenterY + offsetY;
      const offsetTargetCenterX = targetCenterX + offsetX;
      const offsetTargetCenterY = targetCenterY + offsetY;

      // Calculate the absolute positions for the invisible dummy nodes along the offset line.
      const dummy1_x = Math.round((offsetSourceCenterX + ux * LINK_ENDPOINT_OFFSET) * scaleFactor) + CONFIG_X_OFFSET;
      const dummy1_y = Math.round((offsetSourceCenterY + uy * LINK_ENDPOINT_OFFSET) * scaleFactor) + CONFIG_Y_OFFSET;
      const dummy2_x = Math.round((offsetTargetCenterX - ux * LINK_ENDPOINT_OFFSET) * scaleFactor) + CONFIG_X_OFFSET;
      const dummy2_y = Math.round((offsetTargetCenterY - uy * LINK_ENDPOINT_OFFSET) * scaleFactor) + CONFIG_Y_OFFSET;

      const dummy1_id = `node${String(nodeCounter++).padStart(5, '0')}`;
      const dummy2_id = `node${String(nodeCounter++).padStart(5, '0')}`;

      // Add the invisible nodes required for the link to the node string list.
      nodeStrings.push(DUMMY_NODE_TEMPLATE.replace('{id}', dummy1_id).replace('{x}', dummy1_x).replace('{y}', dummy1_y));
      nodeStrings.push(DUMMY_NODE_TEMPLATE.replace('{id}', dummy2_id).replace('{x}', dummy2_x).replace('{y}', dummy2_y));
      
      const interfaceName = edge.data?.interface || 'unknown';
      // Create the link definition that connects the two dummy nodes, now including BANDWIDTH.
      const populatedLink = `LINK ${dummy1_id}-${dummy2_id}
\tNODES ${dummy1_id} ${dummy2_id}
\tDEVICE ${sourceNodeInfo.data.hostname} ${sourceNodeInfo.data.ip}
\tINTERFACE ${interfaceName}
\tBANDWIDTH ${edge.data.bandwidth || '1G'}`;

      linkStrings.push(populatedLink);
    }
  }
  
  // Assemble the final configuration string using the fetched template.
  let finalConfig = configTemplate;
  finalConfig = finalConfig.replace(/%name%/g, mapName);
  finalConfig = finalConfig.replace('%width%', mapWidth);
  finalConfig = finalConfig.replace('%height%', mapHeight);
  finalConfig = finalConfig.replace('%nodes%', nodeStrings.join('\n\n'));
  finalConfig = finalConfig.replace('%links%', linkStrings.join('\n\n'));

  return finalConfig.trim();
}