import numpy as np, sys
from PIL import Image
A='/cursor/stores/store-872635ab-74ab-4009-92ae-3fd1757b0f73/grok-bot/agents/99e5fdc6-f4c8-439f-bb66-965bfca0d0d0/assets/'
src={'office-glass':'c148d6ba','tower':'7a7ef567','car':'3557d815','office-stone':'e919f089','shop':'f7813a3e','tree':'645995f9','taxi':'7b2a19b5','bus':'3304a6d3','props':'467f898e','kiosk':'3512b35c','office-grey':'1240503e'}
import glob
def key(im):
    a=np.asarray(im.convert('RGB')).astype(np.int32); r,g,b=a[...,0],a[...,1],a[...,2]
    gm=(g-np.maximum(r,b))   # green screen strength
    mm=(np.minimum(r,b)-g)   # magenta strength
    c=a[3,3]; s=gm if c[1]>c[0] else mm
    alpha=np.clip(255-(s-40)*255//60,0,255).astype(np.uint8)
    out=a.copy()
    # despill
    gsp=(gm>0)&(c[1]>c[0]); out[...,1]=np.where(gsp,np.maximum(r,b)+np.minimum(gm,0),g)
    msp=(mm>0)&(c[1]<=c[0]); out[...,0]=np.where(msp,np.minimum(r,g+0),out[...,0]); out[...,2]=np.where(msp,np.minimum(b,g+0),out[...,2])
    rgba=np.dstack([np.clip(out,0,255).astype(np.uint8),alpha])
    return Image.fromarray(rgba,'RGBA')
def save(im,name,maxd=512):
    im=im.crop(im.getbbox()); im.thumbnail((maxd,maxd),Image.LANCZOS); im.save(f'assets/sprites/{name}.png'); print(name,im.size)
for n,h in src.items():
    f=glob.glob(A+h+'*')[0]; im=key(Image.open(f))
    if n=='props':
        w,hh=im.size
        for nm,(x,y) in {'bin':(0,0),'lamp':(1,0),'bench':(0,1),'cone':(1,1)}.items(): save(im.crop((x*w//2,y*hh//2,(x+1)*w//2,(y+1)*hh//2)),nm,256)
    else: save(im,n,700 if n=='tower' else 512)
