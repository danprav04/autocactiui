import os
import uuid
import re
from PIL import Image
from werkzeug.security import check_password_hash

# --- Mock Authentication Data ---
# In a real application, this would be replaced with a proper database
# and secure password management. The password 'admin' is hashed.
MOCK_USERS = {
    "admin": {
        "hash": "pbkdf2:sha256:600000$hUSaowPe1mJ14sCt$0392e20b3a323a6368d1502446a0c0a911765c92471f09c647b593685f6f7051"
    }
}

def verify_user(username, password):
    """Verifies user credentials against the mock database."""
    user = MOCK_USERS.get(username)
    if user:
        return {"username": username}
    return None
# ---

# Mock Database simulating your network devices and connections based on the new API spec
MOCK_NETWORK = {
    "10.10.1.3": {
        "hostname": "Core-Router-1",
        "type": "Router",
        "model": "Cisco CSR1000V",
    },
    "10.10.1.2": {
        "hostname": "Dist-Switch-A",
        "type": "Switch",
        "model": "Cisco C9300",
    },
    "10.10.2.2": {
        "hostname": "Dist-Switch-B",
        "type": "Switch",
        "model": "Cisco C9300",
    },
    "192.168.1.10": {
        "hostname": "Access-SW-A1",
        "type": "Switch",
        "model": "Cisco C3560",
    },
    "192.168.1.20": {
        "hostname": "Access-SW-A2",
        "type": "Switch",
        "model": "Cisco C3560",
    },
    "192.168.2.10": {
        "hostname": "Access-SW-B1",
        "type": "Switch",
        "model": "Cisco C3560",
    },
    "172.16.10.5": {
        "hostname": "Firewall-Main",
        "type": "Firewall",
        "model": "Palo Alto PA-220",
    },
    "172.16.20.8": {
        "hostname": "VPN-Encryptor-1",
        "type": "Encryptor",
        "model": "TACLANE-Micro",
    },
    "172.16.30.12": {
        "hostname": "Legacy-Device",
        "type": "Unknown Type",
        "model": "Custom Appliance",
    },
}

MOCK_NEIGHBORS = {
    "10.10.1.3": [
        {"interface": "GigabitEthernet1", "neighbor": "Dist-Switch-A", "ip": "10.10.1.2", "description": "Uplink to Dist-A"},
        {"interface": "GigabitEthernet2", "neighbor": "Dist-Switch-B", "ip": "10.10.2.2", "description": "Uplink to Dist-B"},
        {"interface": "GigabitEthernet3", "neighbor": "Dist-Switch-A", "ip": "10.10.1.2", "description": "Redundant Uplink to Dist-A"},
    ],
    "10.10.1.2": [
        {"interface": "TenGigabitEthernet1/1/1", "neighbor": "Core-Router-1", "ip": "10.10.1.3", "description": "Uplink to Core"},
        {"interface": "TenGigabitEthernet1/1/2", "neighbor": "Dist-Switch-B", "ip": "10.10.2.2", "description": "VRRP Link to Dist-B"},
        {"interface": "TenGigabitEthernet1/1/3", "neighbor": "Core-Router-1", "ip": "10.10.1.3", "description": "Redundant Uplink to Core"},
        {"interface": "GigabitEthernet2/0/1", "neighbor": "Access-SW-A1", "ip": "192.168.1.10", "description": "To Access-SW-A1"},
        {"interface": "GigabitEthernet2/0/2", "neighbor": "Access-SW-A2", "ip": "192.168.1.20", "description": "To Access-SW-A2"},
    ],
    "10.10.2.2": [
        {"interface": "TenGigabitEthernet1/1/1", "neighbor": "Core-Router-1", "ip": "10.10.1.3", "description": "Uplink to Core"},
        {"interface": "TenGigabitEthernet1/1/2", "neighbor": "Dist-Switch-A", "ip": "10.10.1.2", "description": "VRRP Link to Dist-A"},
        {"interface": "GigabitEthernet2/0/1", "neighbor": "Access-SW-B1", "ip": "192.168.2.10", "description": "To Access-SW-B1"},
        {"interface": "GigabitEthernet2/0/2", "neighbor": "VPN-Encryptor-1", "ip": "172.16.20.8", "description": "To Encryptor"},
    ],
    "192.168.1.10": [
        {"interface": "GigabitEthernet1/0/1", "neighbor": "Dist-Switch-A", "ip": "10.10.1.2", "description": "Uplink to Dist-A"},
    ],
    "192.168.1.20": [
        {"interface": "GigabitEthernet1/0/1", "neighbor": "Dist-Switch-A", "ip": "10.10.1.2", "description": "Uplink to Dist-A"},
    ],
    "192.168.2.10": [
        {"interface": "GigabitEthernet1/0/1", "neighbor": "Dist-Switch-B", "ip": "10.10.2.2", "description": "Uplink to Dist-B"},
        {"interface": "GigabitEthernet1/0/2", "neighbor": "Firewall-Main", "ip": "172.16.10.5", "description": "To Firewall"},
    ],
    "172.16.10.5": [
        {"interface": "ethernet1/1", "neighbor": "Access-SW-B1", "ip": "192.168.2.10", "description": "To Access-SW-B1"},
    ],
    "172.16.20.8": [
        {"interface": "eth0", "neighbor": "Dist-Switch-B", "ip": "10.10.2.2", "description": "Uplink"},
        {"interface": "eth1", "neighbor": "Legacy-Device", "ip": "172.16.30.12", "description": "To Legacy Device"},
    ],
    "172.16.30.12": [
        {"interface": "eno1", "neighbor": "VPN-Encryptor-1", "ip": "172.16.20.8", "description": "Uplink"},
    ]
}

MOCK_CACTI_INSTALLATIONS = [
    {
        "id": 1,
        "hostname": "cacti-main-dc",
        "ip": "192.168.1.100",
        "user": "admin",
        "password": "password123"
    },
    {
        "id": 2,
        "hostname": "cacti-prod-london",
        "ip": "10.200.5.10",
        "user": "cacti_user",
        "password": "secure_password"
    }
]

def get_device_info(ip_address):
    """Fetches device type, model, and hostname by IP address."""
    if ip_address in MOCK_NETWORK:
        device_data = MOCK_NETWORK[ip_address]
        return {
            "ip": ip_address,
            "model": device_data.get("model", "Unknown Model"),
            "type": device_data.get("type", "Unknown Type"),
            "hostname": device_data.get("hostname", "Unknown Hostname")
        }
    return None

def get_device_neighbors(ip_address):
    """Gets CDP neighbors of a device by IP address using SNMP (mocked)."""
    if ip_address in MOCK_NEIGHBORS:
        return {"neighbors": MOCK_NEIGHBORS[ip_address]}
    return None

def get_all_cacti_installations():
    """Retrieves all registered Cacti installations."""
    return {"status": "success", "data": MOCK_CACTI_INSTALLATIONS}

def save_uploaded_map(map_image_file, config_content, map_name):
    """Saves the uploaded map image and config file to the designated folders."""
    # Ensure directories exist
    maps_dir = "static/maps"
    configs_dir = "static/configs"
    os.makedirs(maps_dir, exist_ok=True)
    os.makedirs(configs_dir, exist_ok=True)

    # Generate a unique filename to prevent overwrites and save the files
    unique_id = uuid.uuid4()
    
    # Save Image
    image_filename = f"{map_name}_{unique_id}.png"
    image_path = os.path.join(maps_dir, image_filename)
    image = Image.open(map_image_file.stream)
    image.save(image_path)
    
    # --- MODIFICATION ---
    # The config file needs to point to the *actual* image file we just saved.
    # We will replace the placeholder BACKGROUND line with the correct relative path.
    # This path is relative from the config file's location (`static/configs`) 
    # to the image's location (`static/maps`).
    cacti_image_path = f"../maps/{image_filename}"
    modified_config_content = re.sub(
        r'^(BACKGROUND\s+).*$', 
        fr'\1{cacti_image_path}', 
        config_content, 
        flags=re.MULTILINE
    )

    # Save Config
    config_filename = f"{map_name}_{unique_id}.conf"
    config_path = os.path.join(configs_dir, config_filename)
    with open(config_path, 'w') as f:
        f.write(modified_config_content)

    return {"image_path": image_path, "config_path": config_path}