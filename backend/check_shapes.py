
from vsdx import VisioFile
import os

t = 'c:\\Users\\danip\\Documents\\GitHub\\autocactiui\\backend\\template.vsdx'
try:
    with VisioFile(t) as vis:
        page = vis.get_page(0)
        print(f"Page XML Type: {type(page.xml)}")
        print(f"Number of shapes: {len(page.shapes)}")
        for s in page.shapes:
            print(f"Shape ID: {s.ID}, Master: {s.master_id}, Text: '{s.text}'")
            # print XML tag to see what we have
            # s.xml is the Element
            print(f"Tag: {s.xml.tag}")
except Exception as e:
    print(f"Error: {e}")
