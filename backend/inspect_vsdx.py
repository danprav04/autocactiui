
import vsdx
import os

try:
    path = os.path.dirname(vsdx.__file__)
    print(f"Path: {path}")
    found = False
    for root, dirs, files in os.walk(path):
        for file in files:
            if file.endswith('.vsdx'):
                print(f"Found: {os.path.join(root, file)}")
                found = True
    if not found:
        print("No .vsdx files found in vsdx package")
except Exception as e:
    print(f"Error: {e}")
