
import requests
import json
import sys

url = 'http://localhost:5000/export-visio'
data = {
  "mapName": "My-Network-Map",
  "nodes": [
    {
      "id": "1",
      "position": {"x": 100, "y": 100},
      "width": 100,
      "height": 100,
      "data": {"hostname": "Test-Device", "ip": "192.168.1.1"}
    }
  ]
}

try:
    response = requests.post(url, json=data)
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        if response.content.startswith(b'PK'):
            print("Response is a valid ZIP/VSDX file.")
            with open('test_output.vsdx', 'wb') as f:
                f.write(response.content)
            print("Saved test_output.vsdx")
        else:
            print("Response is NOT a ZIP file.")
            print(response.content[:20])
    else:
        print("Error response:")
        print(response.text)
except Exception as e:
    print(f"Request failed: {e}")
