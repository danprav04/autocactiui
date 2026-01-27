
import zipfile
import sys

t = 'c:\\Users\\danip\\Documents\\GitHub\\autocactiui\\backend\\template.vsdx'
try:
    with zipfile.ZipFile(t, 'r') as z:
        for n in z.namelist():
            print(n)
except Exception as e:
    print(e)
