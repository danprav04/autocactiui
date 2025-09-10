from flask import Flask, jsonify, request, url_for
from flask_cors import CORS
import services
import os
import map_renderer
import jwt
from functools import wraps
from datetime import datetime, timedelta
import logging

app = Flask(__name__)

# --- Logging Configuration ---
# Configure logging to provide detailed output for debugging the map creation process.
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')


# --- Authentication Configuration ---
# In a real production environment, this secret key should be loaded from a secure,
# non-version-controlled location (e.g., environment variables, a vault).
app.config['SECRET_KEY'] = 'your-super-secret-and-complex-key-that-is-not-in-git'
# ---

CORS(app)

# Ensure the directories for storing maps, configs, and final outputs exist
os.makedirs('static/maps', exist_ok=True)
os.makedirs('static/configs', exist_ok=True)
os.makedirs('static/final_maps', exist_ok=True)


# --- Authentication Token Decorator ---
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            # Expected format: "Bearer <token>"
            try:
                auth_header = request.headers['Authorization']
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({'message': 'Malformed Authorization header'}), 401

        if not token:
            return jsonify({'message': 'Token is missing!'}), 401

        try:
            # Decode the token using the secret key
            jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired!'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Token is invalid!'}), 401
        
        return f(*args, **kwargs)
    return decorated


# --- Public Authentication Endpoint ---
@app.route('/login', methods=['POST'])
def login():
    """Authenticates a user and returns a JWT."""
    auth = request.json
    if not auth or not auth.get('username') or not auth.get('password'):
        return jsonify({'message': 'Could not verify'}), 401, {'WWW-Authenticate': 'Basic realm="Login required!"'}

    username = auth.get('username')
    password = auth.get('password')

    user = services.verify_user(username, password)

    if user:
        token = jwt.encode({
            'user': username,
            'exp': datetime.utcnow() + timedelta(hours=24) # Token expires in 24 hours
        }, app.config['SECRET_KEY'], algorithm="HS256")

        return jsonify({'token': token})

    return jsonify({'message': 'Invalid credentials'}), 401


# --- Protected API Endpoints ---
@app.route('/get-device-info/<ip_address>', methods=['GET'])
@token_required
def get_device_info_endpoint(ip_address):
    """Retrieves device type, model, and hostname by IP address."""
    device_info = services.get_device_info(ip_address)
    if device_info:
        return jsonify(device_info)
    return jsonify({"error": "Device not found"}), 404

@app.route('/get-device-neighbors/<ip_address>', methods=['GET'])
@token_required
def get_device_neighbors_endpoint(ip_address):
    """Gets CDP neighbors of a device by IP address using SNMP."""
    neighbors = services.get_device_neighbors(ip_address)
    if neighbors:
        return jsonify(neighbors)
    return jsonify({"error": "Device not found or has no neighbors"}), 404

@app.route('/get-all-cacti-installations', methods=['GET'])
@token_required
def get_all_cacti_installations_endpoint():
    """Retrieves all registered Cacti installations."""
    installations = services.get_all_cacti_installations()
    return jsonify(installations)

@app.route('/upload-map', methods=['POST'])
@token_required
def upload_map_endpoint():
    """
    Uploads a weathermap image and config, then renders and saves a final
    composite image with lines drawn on it.
    """
    if 'map_image' not in request.files:
        return jsonify({"error": "Map image is required"}), 400
    
    map_image = request.files['map_image']
    cacti_id = request.form.get('cacti_installation_id')
    map_name = request.form.get('map_name')
    config_content = request.form.get('config_content')

    if not all([cacti_id, map_name, config_content]):
        return jsonify({"error": "Missing required form data: cacti_installation_id, map_name, or config_content"}), 400

    try:
        app.logger.info(f"Starting map upload for map_name: '{map_name}', Cacti ID: {cacti_id}")

        # Step 1: Save the uploaded background image and the modified .conf file
        saved_paths = services.save_uploaded_map(map_image, config_content, map_name)
        config_path = saved_paths['config_path']
        app.logger.info(f"Saved map assets. Image: {saved_paths['image_path']}, Config: {config_path}")
        
        # Step 2: Define the output path for the final rendered map
        config_filename = os.path.basename(config_path)
        final_map_filename = config_filename.replace('.conf', '.png')
        final_map_path = os.path.join('static/final_maps', final_map_filename)
        app.logger.info(f"Rendering final map to: {final_map_path}")

        # Step 3: Render the final map by drawing lines on the background and save it
        map_renderer.render_and_save_map(config_path, final_map_path)

        # Step 4: Generate a URL for the newly created final map
        # Use url_for for proper URL generation, pointing to the static file
        final_map_url = url_for('static', filename=f'final_maps/{final_map_filename}', _external=True)
        app.logger.info(f"Successfully generated final map. URL: {final_map_url}")

        return jsonify({
            "success": True,
            "message": f"Map '{map_name}' processed and final image saved successfully.",
            "map_name": map_name,
            "paths": saved_paths,
            "final_map_url": final_map_url
        })
    except Exception as e:
        app.logger.error(f"Error during map upload and rendering process for '{map_name}'", exc_info=True)
        return jsonify({"error": "An internal error occurred while processing the map"}), 500

@app.route('/api/devices', methods=['POST'])
@token_required
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