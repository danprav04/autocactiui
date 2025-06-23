from flask import Flask, jsonify, request, url_for
from flask_cors import CORS
import services
import os

app = Flask(__name__)
# In production, you should restrict the origins to your frontend's domain
CORS(app) 

# Ensure the directory for storing maps exists
if not os.path.exists('static/maps'):
    os.makedirs('static/maps')

@app.route('/api/devices/<ip>/neighbors', methods=['GET'])
def get_neighbors_endpoint(ip):
    """Endpoint to get neighbors of a device."""
    neighbors = services.get_device_neighbors(ip)
    if neighbors is None:
        return jsonify({"error": "Device not found"}), 404
    return jsonify(neighbors)

@app.route('/api/devices', methods=['POST'])
def get_initial_device():
    """Endpoint to get the very first device to start the map."""
    data = request.get_json()
    ip = data.get('ip')
    if not ip:
        return jsonify({"error": "IP address is required"}), 400
        
    device = services.get_device_details(ip)
    if device is None:
        return jsonify({"error": "Device not found"}), 404
        
    return jsonify(device)

@app.route('/api/maps', methods=['POST'])
def create_map_endpoint():
    """
    Endpoint to create the final map image.
    Receives node and edge data from the frontend.
    """
    data = request.get_json()
    nodes = data.get('nodes')
    edges = data.get('edges')

    if not nodes or not edges:
        return jsonify({"error": "Nodes and edges data is required"}), 400
    
    try:
        image_path = services.generate_map_image(nodes, edges)
        if image_path is None:
             return jsonify({"error": "Could not generate map, no nodes provided"}), 400
        
        # Construct the full URL for the client
        image_url = request.host_url.rstrip('/') + url_for('static', filename=image_path)
        return jsonify({"map_url": image_url})
    except Exception as e:
        # Log the error properly in a real application
        print(f"Error generating map: {e}")
        return jsonify({"error": "An internal error occurred while generating the map"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)