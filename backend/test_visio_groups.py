import unittest
import io
import sys
import os
import zipfile
from xml.etree import ElementTree as ET

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app import app

class TestVisioExportGroups(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    def test_group_rendering(self):
        payload = {
            "mapName": "Test-Group-Map",
            "nodes": [
                {
                    "id": "device1",
                    "type": "custom",
                    "position": {"x": 100, "y": 100},
                    "data": {"hostname": "Router1", "ip": "1.1.1.1"},
                    "zIndex": 10,
                    "width": 50,
                    "height": 50
                },
                {
                    "id": "group1",
                    "type": "group",
                    "position": {"x": 50, "y": 50},
                    "data": {"label": "My Group"},
                    "zIndex": 1,
                    "width": 200,
                    "height": 200
                }
            ],
            "edges": []
        }

        response = self.app.post('/export-visio', json=payload)
        self.assertEqual(response.status_code, 200)

        # Inspect Zip
        with zipfile.ZipFile(io.BytesIO(response.data)) as z:
            with z.open('visio/pages/page1.xml') as f:
                content = f.read()
                root = ET.fromstring(content)
                
                # Check Shapes
                # Find Shapes tag
                shapes_tag = None
                for child in root:
                    if child.tag.endswith('Shapes'):
                        shapes_tag = child
                        break
                
                self.assertIsNotNone(shapes_tag)
                
                shapes = list(shapes_tag)
                # We expect 2 shapes
                self.assertTrue(len(shapes) >= 2)
                
                # Since we sorted by zIndex, group (zIndex 1) should be first, device (zIndex 10) second.
                shape1 = shapes[0]
                shape2 = shapes[1]
                
                # Verify Shape 1 is the Group
                text1 = ""
                for elem in shape1.iter():
                    if elem.tag.endswith('Text'):
                        text1 = elem.text
                        break
                
                self.assertEqual(text1, "My Group", "First shape should be the group")
                
                # Verify Dimensions of Group
                width_cell = None
                height_cell = None
                for elem in shape1.iter():
                     if 'Cell' in elem.tag:
                         if elem.get('N') == 'Width': width_cell = elem.get('V')
                         if elem.get('N') == 'Height': height_cell = elem.get('V')
                
                # 200 / 96 = 2.08333
                self.assertAlmostEqual(float(width_cell), 200/96.0, places=2)
                self.assertAlmostEqual(float(height_cell), 200/96.0, places=2)

                # Verify Shape 2 is the Device
                text2 = ""
                for elem in shape2.iter():
                    if elem.tag.endswith('Text'):
                        text2 = elem.text
                        break
                
                self.assertIn("Router1", text2)

if __name__ == '__main__':
    unittest.main()
