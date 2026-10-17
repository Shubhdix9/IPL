import os
import numpy as np
from PIL import Image

base = r"C:\Users\SAgar\IPL\client\public\assets\teams"

# 1. DC: crop below text band (tiger heads)
dc_img = Image.open(os.path.join(base, "dc", "logo-full.png"))
# In 350x384: the text ends around y=205. The tigers are y: [205, 360], x: [60, 290]
dc_crop = dc_img.crop((55, 204, 295, 360))
# trim any transparent edges
dc_arr = np.array(dc_crop)
y_idx, x_idx = np.where(dc_arr[:, :, 3] > 0)
dc_emblem = Image.fromarray(dc_arr[y_idx.min():y_idx.max()+1, x_idx.min():x_idx.max()+1])
dc_emblem.save(os.path.join(base, "dc", "emblem-crop.png"))
print(f"DC emblem crop size: {dc_emblem.size}")

# 2. KKR: the knight helmet with flame plume (crop above the shield)
kkr_img = Image.open(os.path.join(base, "kkr", "logo-full.png"))
# In 249x387: the helmet + flame plume is at the top, rows 0 to 142
kkr_crop = kkr_img.crop((55, 0, 195, 142))
kkr_arr = np.array(kkr_crop)
y_idx, x_idx = np.where(kkr_arr[:, :, 3] > 0)
kkr_emblem = Image.fromarray(kkr_arr[y_idx.min():y_idx.max()+1, x_idx.min():x_idx.max()+1])
kkr_emblem.save(os.path.join(base, "kkr", "emblem-crop.png"))
print(f"KKR emblem crop size: {kkr_emblem.size}")

# 3. PBKS: the lion head (crop below 'KINGS')
pbks_img = Image.open(os.path.join(base, "pbks", "logo-full.png"))
# In 303x387: "KINGS" ends around y=180. Lion head is from y=180 to 365
pbks_crop = pbks_img.crop((45, 178, 260, 368))
pbks_arr = np.array(pbks_crop)
y_idx, x_idx = np.where(pbks_arr[:, :, 3] > 0)
pbks_emblem = Image.fromarray(pbks_arr[y_idx.min():y_idx.max()+1, x_idx.min():x_idx.max()+1])
pbks_emblem.save(os.path.join(base, "pbks", "emblem-crop.png"))
print(f"PBKS emblem crop size: {pbks_emblem.size}")

# 4. RR: the crown + RR monogram (crop above 'RAJASTHAN ROYALS')
rr_img = Image.open(os.path.join(base, "rr", "logo-full.png"))
# In 251x392: "RAJASTHAN ROYALS" text starts around y=290. Monogram + crown is y: [0, 288]
rr_crop = rr_img.crop((0, 0, 251, 288))
rr_arr = np.array(rr_crop)
y_idx, x_idx = np.where(rr_arr[:, :, 3] > 0)
rr_emblem = Image.fromarray(rr_arr[y_idx.min():y_idx.max()+1, x_idx.min():x_idx.max()+1])
rr_emblem.save(os.path.join(base, "rr", "emblem-crop.png"))
print(f"RR emblem crop size: {rr_emblem.size}")

# 5. SRH: the eagle with sun rays and wings
srh_img = Image.open(os.path.join(base, "srh", "logo-full.png"))
# In 868x652: the upper portion has wings, sun, eagle head (y: 0 to 360).
# Let's crop y: [0, 360] and trim
srh_crop = srh_img.crop((0, 0, 868, 360))
srh_arr = np.array(srh_crop)
y_idx, x_idx = np.where(srh_arr[:, :, 3] > 0)
srh_emblem = Image.fromarray(srh_arr[y_idx.min():y_idx.max()+1, x_idx.min():x_idx.max()+1])
srh_emblem.save(os.path.join(base, "srh", "emblem-crop.png"))
print(f"SRH emblem crop size: {srh_emblem.size}")
