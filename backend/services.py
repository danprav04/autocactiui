from PIL import Image, ImageDraw, ImageFont
from io import BytesIO
import uuid

# Mock Database simulating your network devices and connections
MOCK_NETWORK = {
    "10.10.1.3": {"hostname": "Core-Router-1", "type": "Router", "neighbors": ["10.10.1.2", "10.10.2.2"]},
    "10.10.1.2": {"hostname": "Dist-Switch-A", "type": "Switch", "neighbors": ["189.1.5.5", "192.168.1.10", "192.168.1.20"]},
    "10.10.2.2": {"hostname": "Dist-Switch-B", "type": "Switch", "neighbors": ["189.1.5.5", "192.168.2.10"]},
    "192.168.1.10": {"hostname": "Access-SW-A1", "type": "Switch", "neighbors": ["10.10.1.2"]},
    "192.168.1.20": {"hostname": "Access-SW-A2", "type": "Switch", "neighbors": ["10.10.1.2"]},
    "192.168.2.10": {"hostname": "Access-SW-B1", "type": "Switch", "neighbors": ["10.10.2.2", "172.16.10.5"]},
    "172.16.10.5": {"hostname": "Firewall-Main", "type": "Firewall", "neighbors": ["192.168.2.10"]},
}

def get_device_details(ip):
    """Fetches details for a single device."""
    if ip in MOCK_NETWORK:
        return {"ip": ip, **MOCK_NETWORK[ip]}
    return None

def get_device_neighbors(ip):
    """Fetches the neighbors of a device."""
    device = get_device_details(ip)
    if not device:
        return None
    
    neighbor_details = []
    for neighbor_ip in device.get("neighbors", []):
        neighbor = get_device_details(neighbor_ip)
        if neighbor:
            neighbor_details.append(neighbor)
            
    return neighbor_details

def generate_map_image(nodes, edges):
    """
    Generates a map image from node and edge data provided by the frontend.
    This is a simplified version of your original drawing logic.
    """
    padding = 100
    canvas_width = 1280
    canvas_height = 720
    node_radius = 30

    img = Image.new('RGB', (canvas_width, canvas_height), 'white')
    draw = ImageDraw.Draw(img)

    # Use a basic font. For production, ensure the font file is available on the server.
    try:
        font = ImageFont.truetype("arial.ttf", 14)
    except IOError:
        font = ImageFont.load_default()

    # Create a mapping from node ID (IP) to its position from react-flow
    node_positions = {node['id']: (node['position']['x'], node['position']['y']) for node in nodes}
    
    # Find min/max coordinates to scale the positions to fit the canvas
    if not node_positions: # Handle case with no nodes
        return None

    min_x = min(pos[0] for pos in node_positions.values())
    max_x = max(pos[0] for pos in node_positions.values())
    min_y = min(pos[1] for pos in node_positions.values())
    max_y = max(pos[1] for pos in node_positions.values())

    # Draw Edges
    for edge in edges:
        source_pos = node_positions.get(edge['source'])
        target_pos = node_positions.get(edge['target'])
        if source_pos and target_pos:
            draw.line([source_pos, target_pos], fill="black", width=2)
            
    # Draw Nodes and Labels
    for node in nodes:
        pos = node_positions.get(node['id'])
        if pos:
            # Draw circle for the node
            draw.ellipse(
                (pos[0] - node_radius, pos[1] - node_radius, pos[0] + node_radius, pos[1] + node_radius),
                fill="lightblue",
                outline="black"
            )
            # Draw label
            label = node['data']['label']
            text_width, text_height = draw.textsize(label, font=font)
            draw.text(
                (pos[0] - text_width / 2, pos[1] - text_height / 2),
                label,
                fill="black",
                font=font
            )

    # Save image to a static file
    filename = f"{uuid.uuid4()}.png"
    filepath = f"static/maps/{filename}"
    img.save(filepath)
    
    return f"/maps/{filename}" # Return the URL path