import re
import os
from PIL import Image, ImageDraw

def parse_config(config_content):
    """
    Parses Cacti weathermap config content to extract the background image path,
    node positions, and link connections using a robust block-parsing method.
    """
    data = {'nodes': {}, 'links': []}
    
    # Extract the background image path, ensuring it's at the start of a line
    background_match = re.search(r'^BACKGROUND\s+(.*)', config_content, re.MULTILINE)
    if background_match:
        data['background'] = background_match.group(1).strip()

    # This robust regex pattern correctly captures multi-line blocks.
    # It reads from a keyword (NODE/LINK) until it sees the next keyword or the end of the file.
    node_pattern = re.compile(r'^NODE\s+(\S+)\n(.*?)(?=^NODE|^LINK|\Z)', re.DOTALL | re.MULTILINE)
    link_pattern = re.compile(r'^LINK\s+(\S+)\n(.*?)(?=^NODE|^LINK|\Z)', re.DOTALL | re.MULTILINE)

    # Parse all NODE blocks to find their positions
    for match in node_pattern.finditer(config_content):
        node_id = match.group(1)
        node_body = match.group(2)
        node_data = {}

        # Search for the POSITION within the captured block
        pos_match = re.search(r'^\s*POSITION\s+(\d+)\s+(\d+)', node_body, re.MULTILINE)
        if pos_match:
            node_data['x'] = int(pos_match.group(1))
            node_data['y'] = int(pos_match.group(2))
        
        if 'x' in node_data and 'y' in node_data:
            data['nodes'][node_id] = node_data

    # Parse all LINK blocks to find their connections
    for match in link_pattern.finditer(config_content):
        link_id = match.group(1)
        link_body = match.group(2)

        # Skip the "LINK DEFAULT" template block
        if link_id == 'DEFAULT':
            continue

        # Search for the NODES line within the captured block
        nodes_match = re.search(r'^\s*NODES\s+(\S+)\s+(\S+)', link_body, re.MULTILINE)
        if nodes_match:
            data['links'].append({
                'node1': nodes_match.group(1),
                'node2': nodes_match.group(2)
            })

    return data

def render_map_from_config(config_path):
    """
    Renders a final map image by drawing the links defined in a .conf file
    onto the specified background image. Returns a PIL Image object.
    """
    if not os.path.exists(config_path):
        raise FileNotFoundError(f"Config file not found at {config_path}")

    with open(config_path, 'r') as f:
        config_content = f.read()

    map_data = parse_config(config_content)

    if not map_data.get('background'):
        raise ValueError("BACKGROUND image path not found in config file.")

    config_dir = os.path.dirname(config_path)
    background_image_path = os.path.normpath(os.path.join(config_dir, map_data['background']))
    
    if not os.path.exists(background_image_path):
        raise FileNotFoundError(f"Background image not found at {background_image_path}")

    image = Image.open(background_image_path).convert("RGBA")
    draw = ImageDraw.Draw(image)

    LINK_COLORS = ['#E6194B', '#3CB44B', '#4363D8', '#F58231', '#911EB4', '#46F0F0', '#FABEBE', '#008080', '#E6BEFF', '#AA6E28']
    color_index = 0

    for link in map_data['links']:
        node1_id = link['node1']
        node2_id = link['node2']

        if node1_id in map_data['nodes'] and node2_id in map_data['nodes']:
            node1 = map_data['nodes'][node1_id]
            node2 = map_data['nodes'][node2_id]
            
            current_color = LINK_COLORS[color_index % len(LINK_COLORS)]
            color_index += 1
            
            draw.line(
                [(node1['x'], node1['y']), (node2['x'], node2['y'])], 
                fill=current_color, 
                width=4
            )

    return image

def render_and_save_map(config_path, output_path):
    """
    Renders a map from a config file and saves it to a specified path.
    """
    final_image = render_map_from_config(config_path)

    output_dir = os.path.dirname(output_path)
    os.makedirs(output_dir, exist_ok=True)

    final_image.save(output_path, 'PNG')
    print(f"Final map image saved to {output_path}")