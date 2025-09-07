import os
import uuid
from PIL import Image

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
}

MOCK_NEIGHBORS = {
    "10.10.1.3": [
        {"interface": "GigabitEthernet1", "neighbor": "Dist-Switch-A", "ip": "10.10.1.2", "description": "Uplink to Dist-A"},
        {"interface": "GigabitEthernet2", "neighbor": "Dist-Switch-B", "ip": "10.10.2.2", "description": "Uplink to Dist-B"},
    ],
    "10.10.1.2": [
        {"interface": "TenGigabitEthernet1/1/1", "neighbor": "Core-Router-1", "ip": "10.10.1.3", "description": "Uplink to Core"},
        {"interface": "GigabitEthernet2/0/1", "neighbor": "Access-SW-A1", "ip": "192.168.1.10", "description": "To Access-SW-A1"},
        {"interface": "GigabitEthernet2/0/2", "neighbor": "Access-SW-A2", "ip": "192.168.1.20", "description": "To Access-SW-A2"},
    ],
    "10.10.2.2": [
        {"interface": "TenGigabitEthernet1/1/1", "neighbor": "Core-Router-1", "ip": "10.10.1.3", "description": "Uplink to Core"},
        {"interface": "GigabitEthernet2/0/1", "neighbor": "Access-SW-B1", "ip": "192.168.2.10", "description": "To Access-SW-B1"},
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
    
    # Save Config
    config_filename = f"{map_name}_{unique_id}.conf"
    config_path = os.path.join(configs_dir, config_filename)
    with open(config_path, 'w') as f:
        f.write(config_content)

    return {"image_path": image_path, "config_path": config_path}