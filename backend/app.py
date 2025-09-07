from flask import Flask, jsonify, request
from flask_cors import CORS
import services
import os

app = Flask(__name__)
# In production, you should restrict the origins to your frontend's domain
CORS(app)

# Ensure the directories for storing maps and configs exist
os.makedirs('static/maps', exist_ok=True)
os.makedirs('static/configs', exist_ok=True)

@app.route('/get-device-info/<ip_address>', methods=['GET'])
def get_device_info_endpoint(ip_address):
    """Retrieves device type, model, and hostname by IP address."""
    device_info = services.get_device_info(ip_address)
    if device_info:
        return jsonify(device_info)
    return jsonify({"error": "Device not found"}), 404

@app.route('/get-device-neighbors/<ip_address>', methods=['GET'])
def get_device_neighbors_endpoint(ip_address):
    """Gets CDP neighbors of a device by IP address using SNMP."""
    neighbors = services.get_device_neighbors(ip_address)
    if neighbors:
        return jsonify(neighbors)
    return jsonify({"error": "Device not found or has no neighbors"}), 404

@app.route('/upload-map', methods=['POST'])
def upload_map_endpoint():
    """Uploads a weathermap image and configuration."""
    if 'map_image' not in request.files:
        return jsonify({"error": "Map image is required"}), 400
    
    map_image = request.files['map_image']
    cacti_id = request.form.get('cacti_installation_id')
    map_name = request.form.get('map_name')
    config_content = request.form.get('config_content')

    if not all([cacti_id, map_name, config_content]):
        return jsonify({"error": "Missing required form data: cacti_installation_id, map_name, or config_content"}), 400

    try:
        saved_paths = services.save_uploaded_map(map_image, config_content, map_name)
        return jsonify({
            "success": True,
            "message": f"Map '{map_name}' and its configuration have been saved successfully.",
            "map_name": map_name,
            "paths": saved_paths
        })
    except Exception as e:
        print(f"Error saving uploaded map: {e}")
        return jsonify({"error": "An internal error occurred while saving the map"}), 500

# This endpoint is kept for the frontend's initial device fetch logic,
# which uses a POST request to start a new map.
@app.route('/api/devices', methods=['POST'])
def get_initial_device():
    """Endpoint to get the very first device to start the map."""
    data = request.get_json()
    ip = data.get('ip')
    if not ip:
        return jsonify({"error": "IP address is required"}), 400
        
    device = services.get_device_info(ip)
    if device is None:
        return jsonify({"error": "Device not found"}), 404
        
    return jsonify(device)

if __name__ == '__main__':
    app.run(debug=True, port=5000)