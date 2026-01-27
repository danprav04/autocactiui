
from vsdx import VisioFile
import os

t = 'c:\\Users\\danip\\Documents\\GitHub\\autocactiui\\backend\\template.vsdx'
try:
    if os.path.exists(t):
        with VisioFile(t) as vis:
            page = vis.get_page(0)
            print("Methods of page:")
            for m in dir(page):
                if not m.startswith('__'):
                    print(m)
    else:
        print("Template not found")
except Exception as e:
    print(f"Error: {e}")
