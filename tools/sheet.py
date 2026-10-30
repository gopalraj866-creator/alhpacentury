import sys, glob
from PIL import Image
files = sys.argv[2:]
out = sys.argv[1]
ims = [Image.open(f) for f in files]
w = 960
ims = [i.resize((w, int(i.height * w / i.width))) for i in ims]
cols = 2 if ims[0].width >= ims[0].height else 4
if ims[0].height > ims[0].width: w = 480; ims = [i.resize((w, int(i.height * w / i.width))) for i in ims]
rows = (len(ims) + cols - 1) // cols
H = max(i.height for i in ims)
sheet = Image.new('RGB', (cols * ims[0].width, rows * H))
for k, im in enumerate(ims): sheet.paste(im, ((k % cols) * ims[0].width, (k // cols) * H))
sheet.save(out, quality=88)
print(out, sheet.size)
