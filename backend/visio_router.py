
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

        # Map node types to icon filenames (assuming they are in backend/static/icons/)
        # Using the "light" theme icons (black lines) for Visio
        ICON_MAP = {
            'Router': 'router-black.png',
            'Switch': 'switch-black.png',
            'Firewall': 'firewall.png',
            'Encryptor': 'encryptor-black.png',
            'Unknown': 'firewall.png' # Fallback
        }

        # Prepare images to be embedded
        # We need to assign each image a relationship ID (rId) in the page's .rels file
        # And we need to know the Content Type
        
        # Load available icons into memory
        loaded_icons = {} # type -> { filename, bytes, rel_id (assigned later) }
        icons_dir = os.path.join(os.path.dirname(__file__), 'static', 'icons')
        
        for node in nodes:
            node_type = node.get('type', 'custom')
            # The 'type' in node data from frontend might be 'custom', so we check 'data.type' or 'data.icon'
            # Based on frontend/src/components/CustomNode.js or similar, usually it's in data.
            
            # Let's inspect the node structure from the previous request or standard ReactFlow
            # node = { id, type, position, data: { label, ip, type, ... } }
            real_type = node.get('data', {}).get('type', 'Unknown')
            
            # Normalize type string (e.g. "Router" vs "router") - keys in ICON_MAP are Capitalized
            # But let's check exact matches or Case-insensitive
            found_key = 'Unknown'
            for key in ICON_MAP:
                if key.lower() == real_type.lower():
                    found_key = key
                    break
            
            if found_key not in loaded_icons:
                filename = ICON_MAP[found_key]
                path = os.path.join(icons_dir, filename)
                if os.path.exists(path):
                    with open(path, 'rb') as f:
                        loaded_icons[found_key] = {
                            'filename': filename,
                            'bytes': f.read()
                        }
                else:
                    # If file doesn't exist, we might skip or use a default if we had one
                    print(f"Warning: Icon {filename} not found at {path}")

        # In-memory output zip
        output_io = io.BytesIO()
        
        with zipfile.ZipFile(TEMPLATE_PATH, 'r') as zin:
            with zipfile.ZipFile(output_io, 'w', zipfile.ZIP_DEFLATED) as zout:
                
                # We need to modify:
                # 1. visio/pages/page1.xml (The shapes)
                # 2. visio/pages/_rels/page1.xml.rels (The relationships to images)
                # 3. [Content_Types].xml (To declare png content type if missing)
                # 4. Add the image files to visio/media/
                
                # First, pass through everything except what we want to modify
                for item in zin.infolist():
                    if item.filename in ['visio/pages/page1.xml', 'visio/pages/_rels/page1.xml.rels', '[Content_Types].xml']:
                        continue
                    zout.writestr(item, zin.read(item.filename))
                
                # --- Handle Content Types ---
                ct_content = zin.read('[Content_Types].xml').decode('utf-8')
                if 'image/png' not in ct_content:
                    # Add png content type
                    # <Default Extension="png" ContentType="image/png"/>
                    ct_tree = ET.ElementTree(ET.fromstring(ct_content))
                    ct_root = ct_tree.getroot()
                    # Check if Default ext=png exists
                    ns_ct = 'http://schemas.openxmlformats.org/package/2006/content-types'
                    png_exists = False
                    for child in ct_root:
                        if child.tag.endswith('Default') and child.get('Extension') == 'png':
                            png_exists = True
                            break
                    
                    if not png_exists:
                        elem = ET.Element(f'{{{ns_ct}}}Default', {'Extension': 'png', 'ContentType': 'image/png'})
                        ct_root.insert(0, elem)
                        
                    out_ct = io.BytesIO()
                    ct_tree.write(out_ct, encoding='utf-8', xml_declaration=True)
                    zout.writestr('[Content_Types].xml', out_ct.getvalue())
                else:
                     zout.writestr('[Content_Types].xml', ct_content.encode('utf-8'))


                # --- Handle Relationships (rels) ---
                # We need to assign rIds to our images.
                # Existing rels:
                rels_content = zin.read('visio/pages/_rels/page1.xml.rels')
                rels_tree = ET.ElementTree(ET.fromstring(rels_content))
                rels_root = rels_tree.getroot()
                
                ns_rels = 'http://schemas.openxmlformats.org/package/2006/relationships'
                
                # Find max rId
                max_rid = 0
                for rel in rels_root:
                    rid_str = rel.get('Id', 'rId0')
                    try:
                        rid_val = int(rid_str.replace('rId', ''))
                        if rid_val > max_rid: max_rid = rid_val
                    except:
                        pass
                
                # Create rels for icons
                for icon_type, icon_data in loaded_icons.items():
                    max_rid += 1
                    rId = f"rId{max_rid}"
                    icon_data['rel_id'] = rId
                    
                    # Target is relative to the page folder (visio/pages/)
                    # Images will be in visio/media/
                    # So Target = "../media/filename.png"
                    target = f"../media/{icon_data['filename']}"
                    
                    new_rel = ET.Element(f'{{{ns_rels}}}Relationship', {
                        'Id': rId,
                        'Type': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
                        'Target': target
                    })
                    rels_root.append(new_rel)
                
                # Write updated rels
                out_rels = io.BytesIO()
                rels_tree.write(out_rels, encoding='utf-8', xml_declaration=True)
                zout.writestr('visio/pages/_rels/page1.xml.rels', out_rels.getvalue())
                
                # --- Write Image Files ---
                for icon_data in loaded_icons.values():
                    zout.writestr(f"visio/media/{icon_data['filename']}", icon_data['bytes'])


                # --- Handle Page XML (Shapes) ---
                page_content = zin.read('visio/pages/page1.xml')
                page_tree = ET.ElementTree(ET.fromstring(page_content))
                page_root = page_tree.getroot()
                
                # Find Shapes container
                # Namespace issue again, use local name or registered NS
                # page_root is usually {http://schemas.microsoft.com/office/visio/2012/main}PageContents
                
                shapes_tag = None
                for child in page_root:
                    if child.tag.endswith('Shapes'):
                        shapes_tag = child
                        break
                
                if shapes_tag is not None:
                    # Clear existing shapes (template might have some)
                    shapes_tag.clear()
                    
                    current_id = 1
                    page_height_inches = 11.69 # A4 height approx
                    # Try to find page height in PageSheet props if needed, but standardizing is safer for simple export
                    
                    for node in nodes:
                        real_type = node.get('data', {}).get('type', 'Unknown')
                        
                        # Find icon key
                        icon_key = 'Unknown'
                        for key in ICON_MAP:
                            if key.lower() == real_type.lower():
                                icon_key = key
                                break
                        
                        rel_id = loaded_icons.get(icon_key, {}).get('rel_id')
                        
                        if not rel_id:
                            # Skip if no icon (shouldn't happen with fallback)
                            continue

                        shape_id = current_id
                        current_id += 1
                        
                        # Calculate position (Visio uses center-based PinX/PinY in inches usually)
                        # ReactFlow usually x,y top-left in px. 96px = 1 inch
                        x_px = node['position']['x']
                        y_px = node['position']['y'] # From top
                        
                        # Dimensions
                        # Frontend uses 140px. 140/96 ~= 1.45 inches.
                        # Let's use 1.5 inches for clarity and to ensure enough space.
                        w_in = 1.5
                        h_in = 1.5
                        
                        # Center point calculation
                        pin_x = (x_px / 96.0) + (w_in / 2.0)
                        pin_y = page_height_inches - ((y_px / 96.0) + (h_in / 2.0))
                        
                        # Create Shape Element
                        # We use a simple shape with ForeignData for the image
                        shape_el = ET.Element('Shape', {
                            'ID': str(shape_id),
                            'NameU': f"{icon_key}.{shape_id}",
                            'Name': f"{icon_key}.{shape_id}",
                            'Type': 'Foreign' # Important for images
                        })
                        
                        # Transform (XForm)
                        xform = ET.SubElement(shape_el, 'Cell', {'N': 'PinX', 'V': str(pin_x)})
                        ET.SubElement(shape_el, 'Cell', {'N': 'PinY', 'V': str(pin_y)})
                        ET.SubElement(shape_el, 'Cell', {'N': 'Width', 'V': str(w_in)})
                        ET.SubElement(shape_el, 'Cell', {'N': 'Height', 'V': str(h_in)})
                        
                        # Formatting: No Fill to ensure transparency works and doesn't block anything
                        ET.SubElement(shape_el, 'Cell', {'N': 'FillPattern', 'V': '0'})
                        ET.SubElement(shape_el, 'Cell', {'N': 'LinePattern', 'V': '0'}) # No border line around the icon
                        
                        # ForeignData pointing to rel_id
                        # <ForeignData r:id="rIdX" />
                        fd = ET.SubElement(shape_el, 'ForeignData', {
                            '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id': rel_id
                        })
                        
                        # Text Label
                        # To prevent vertical wrapping, we set TxtWidth to be wider than the shape.
                        # We also position it below the shape.
                        
                        hostname = node['data'].get('hostname', '')
                        ip = node['data'].get('ip', '')
                        text_val = f"{hostname}\n{ip}"
                        
                        text_el = ET.SubElement(shape_el, 'Text')
                        text_el.text = text_val
                        
                        # Text Transform
                        # TxtWidth: Allow more width for text than the icon itself (e.g. 3 inches)
                        ET.SubElement(shape_el, 'Cell', {'N': 'TxtWidth', 'V': '3'})
                        
                        # TxtPinY: Center of rotation for text block. 
                        # To move text below, we shift the text block.
                        # Visio Text positioning is tricky. 
                        # Simple approach: TxtPinY (center of text block relative to shape height).
                        # Shape Height is 0 to h_in. 
                        # We want text center to be at roughly -0.5 inches (below 0).
                        ET.SubElement(shape_el, 'Cell', {'N': 'TxtPinY', 'V': '-0.5'})
                        ET.SubElement(shape_el, 'Cell', {'N': 'TxtLocPinY', 'V': '0.5'}) # Center of text block
                        # Also center horizontally
                        ET.SubElement(shape_el, 'Cell', {'N': 'TxtPinX', 'V': str(w_in / 2.0)})
                        ET.SubElement(shape_el, 'Cell', {'N': 'TxtLocPinX', 'V': '1.5'}) # Center of 3-inch text block
                        
                        shapes_tag.append(shape_el)

                # Write updated page
                out_page = io.BytesIO()
                page_tree.write(out_page, encoding='utf-8', xml_declaration=True)
                zout.writestr('visio/pages/page1.xml', out_page.getvalue())
        
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
