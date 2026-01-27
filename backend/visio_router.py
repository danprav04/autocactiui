
from flask import Blueprint, request, send_file, jsonify
import os
import shutil
import io
import copy
import zipfile
from xml.etree import ElementTree as ET

visio_bp = Blueprint('visio_bp', __name__)

TEMPLATE_PATH = os.path.join(os.path.dirname(__file__), 'template.vsdx')

# Namespaces typically used in Visio VSDX
NS = {
    'visio': 'http://schemas.microsoft.com/office/visio/2012/main'
}
# We need to register namespace to preserve prefixes or handle them
for prefix, uri in NS.items():
    ET.register_namespace(prefix if prefix != 'visio' else '', uri) # Try to register default

@visio_bp.route('/export-visio', methods=['POST'])
def export_visio():
    try:
        data = request.json
        map_name = data.get('mapName', 'Network-Map')
        nodes = data.get('nodes', [])

        if not os.path.exists(TEMPLATE_PATH):
             import vsdx
             lib_path = os.path.join(os.path.dirname(vsdx.__file__), 'media', 'media.vsdx')
             if os.path.exists(lib_path):
                 shutil.copy(lib_path, TEMPLATE_PATH) # cache it
             else:
                 return jsonify({"error": "Template not found"}), 500

        # In-memory output zip
        output_io = io.BytesIO()
        
        with zipfile.ZipFile(TEMPLATE_PATH, 'r') as zin:
            with zipfile.ZipFile(output_io, 'w', zipfile.ZIP_DEFLATED) as zout:
                for item in zin.infolist():
                    if item.filename == 'visio/pages/page1.xml':
                        # Read and modify Page XML
                        xml_content = zin.read(item.filename)
                        tree = ET.ElementTree(ET.fromstring(xml_content))
                        root = tree.getroot()
                        
                        # Find Shapes tag
                        # Usually {http://schemas.microsoft.com/office/visio/2012/main}Shapes
                        # We use local name check for robustness
                        shapes_tag = None
                        for child in root:
                            if child.tag.endswith('Shapes'):
                                shapes_tag = child
                                break
                        
                        if shapes_tag is not None and len(shapes_tag) > 0:
                            prototype = shapes_tag[0]
                            prototype_Copy = copy.deepcopy(prototype)
                            shapes_tag.clear()
                            
                            current_id = 1
                            page_height = 11.0 # Assume default or parse <PageProps> -> PageHeight
                            
                            # Try to find PageHeight in PageProps
                            # <PageSheet> <Cell N='PageHeight' V='...'/> </PageSheet>
                            # It's usually in a separate PageSheet element or similar properties
                            # We'll stick to 11.0 default for robustness or try to read it
                            
                            for node in nodes:
                                new_shape = copy.deepcopy(prototype_Copy)
                                new_shape.set('ID', str(current_id))
                                new_shape.set('NameU', f"Sheet.{current_id}")
                                new_shape.set('Name', f"Sheet.{current_id}")
                                current_id += 1
                                
                                x = node['position']['x']
                                y = node['position']['y']
                                w = node.get('width', 100)
                                h = node.get('height', 100)
                                
                                pin_x = (x + (w / 2.0)) / 96.0
                                pin_y = page_height - ((y + (h / 2.0)) / 96.0)
                                
                                for elem in new_shape.iter():
                                     if 'Cell' in elem.tag:
                                         n = elem.get('N')
                                         if n == 'PinX': elem.set('V', str(pin_x))
                                         if n == 'PinY': elem.set('V', str(pin_y))
                                
                                # Text
                                label = node['data'].get('hostname', '')
                                ip = node['data'].get('ip', '')
                                text_content = f"{label}\n{ip}"
                                
                                text_elem = None
                                for elem in new_shape.iter():
                                    if elem.tag.endswith('Text'):
                                        text_elem = elem
                                        break
                                
                                if text_elem is not None:
                                    text_elem.text = text_content
                                
                                shapes_tag.append(new_shape)

                        # Write modified XML
                        # Use method to properly handle namespaces if possible, or just tostring
                        out_xml = io.BytesIO()
                        tree.write(out_xml, encoding='utf-8', xml_declaration=True)
                        zout.writestr(item.filename, out_xml.getvalue())
                        
                    else:
                        # Copy other files
                        zout.writestr(item, zin.read(item.filename))
        
        output_io.seek(0)
        return send_file(
            output_io,
            as_attachment=True,
            download_name=f"{map_name}.vsdx",
            mimetype='application/vnd.visio'
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
