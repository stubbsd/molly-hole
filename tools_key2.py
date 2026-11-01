import numpy as np, glob
from PIL import Image
A='/cursor/stores/store-872635ab-74ab-4009-92ae-3fd1757b0f73/grok-bot/agents/99e5fdc6-f4c8-439f-bb66-965bfca0d0d0/assets/'
def key(im):
    a=np.asarray(im.convert('RGB')).astype(np.float32)
    bg=np.median(np.concatenate([a[:8,:8].reshape(-1,3),a[:8,-8:].reshape(-1,3),a[-8:,:8].reshape(-1,3),a[-8:,-8:].reshape(-1,3)]),0)
    d=np.sqrt(((a-bg)**2).sum(-1))
    al=np.clip((d-45)/40,0,1)
    # despill: pull bg colour out of semi-transparent edge pixels
    out=a.copy(); m=(al<1)&(al>0)
    out[m]=np.clip((a[m]-bg*(1-al[m,None]))/np.maximum(al[m,None],.05),0,255)
    # extra despill for dominant channel
    if bg[1]>bg[0]:
        e=(al<0.98)|(out[...,1]>np.maximum(out[...,0],out[...,2])+60); out[...,1]=np.where(e,np.minimum(out[...,1],np.maximum(out[...,0],out[...,2])*1.05+10),out[...,1])
    else: out[...,0]=np.where((out[...,0]>out[...,1]+40)&(out[...,2]>out[...,1]+40),np.minimum(out[...,0],out[...,1]+20),out[...,0]); al=np.where((a[...,0]>a[...,1]+70)&(a[...,2]>a[...,1]+50),al*0.3,al)
    return Image.fromarray(np.dstack([out,al*255]).astype(np.uint8),'RGBA')
def save(im,name,maxd=512):
    im=im.crop(im.getbbox()); im.thumbnail((maxd,maxd),Image.LANCZOS); im.save(f'assets/sprites/{name}.png'); print(name,im.size)
g=lambda h: key(Image.open(glob.glob(A+h+'*')[0]))
save(g('9a2003a7'),'hr-glass',800); save(g('afdbea6e'),'hr-stone',800); save(g('92fe5013'),'hr-dark',800)
for h,n in [('6c8c642b','car'),('af5453b5','taxi')]:
    im=g(h); w,H=im.size
    save(im.crop((0,0,int(w*.44),H)),n+'-side',320); save(im.crop((int(w*.44),0,int(w*.72),H)),n+'-front',240); save(im.crop((int(w*.72),0,w,H)),n+'-rear',240)
im=g('3726d93d'); w,H=im.size
save(im.crop((0,0,w,H//2)),'bus-side',400); save(im.crop((0,H//2,w//2,H)),'bus-front',360); save(im.crop((w//2,H//2,w,H)),'bus-rear',360)
