from PIL import Image, ImageDraw, ImageFont
import numpy as np, colorsys, math
tiers=[np.array(Image.open(f'a{i}_native.png')).astype(float) for i in (1,2,3)]
# pad to same width
W=max(t.shape[1] for t in tiers); tiers=[np.pad(t,((0,0),(0,W-t.shape[1]),(0,0))) for t in tiers]
def hsv(a):
    r,g,b=[a[...,i]/255 for i in range(3)]
    mx=np.max(a[...,:3],axis=2)/255; mn=np.min(a[...,:3],axis=2)/255; d=mx-mn
    h=np.zeros_like(mx)
    m=d>1e-6
    rr=(mx==r)&m; gg=(mx==g)&m&~rr; bb=m&~rr&~gg
    h[rr]=((g-b)[rr]/d[rr])%6; h[gg]=((b-r)[gg]/d[gg])+2; h[bb]=((r-g)[bb]/d[bb])+4
    h=h*60; s=np.where(mx>0,d/np.maximum(mx,1e-6),0); return h,s,mx
def rgb(h,s,v):
    h=(h%360)/60; i=np.floor(h).astype(int)%6; f=h-np.floor(h)
    p=v*(1-s); q=v*(1-s*f); t=v*(1-s*(1-f))
    r=np.choose(i,[v,q,p,p,t,v]); g=np.choose(i,[t,v,v,q,p,p]); b=np.choose(i,[p,p,t,v,v,q])
    return np.stack([r,g,b],-1)*255
def groups(a):
    h,s,v=hsv(a); al=a[...,3]>0
    glow=al&(s>0.45)&(v>0.55)&((h<50)|(h>340))
    trim=al&~glow&(h>=30)&(h<=60)&(s>0.3)&(v>0.35)
    wood=al&~glow&~trim&(h>=5)&(h<45)&(s>0.15)&(v<0.45)
    metal=al&~glow&~trim&~wood&(v>0.12)
    return h,s,v,glow,trim,wood,metal
FL=[25,45,0,200,280,130,330,170]      # 불꽃 색상 순환: 주황·금·백열·청·자·녹·홍·청록
FLS=[1,1,0.15,1,1,1,1,1]
MT=[(None,0),(215,.18),(30,.22),(270,.2),(350,.2),(150,.18),(0,.0),(195,.25)]  # 쇠 기운: 무쇠·청강·청동·흑요·적철·비취·백은·한빙
TR=[(45,1),(20,.9),(0,0),(190,.8),(285,.8),(130,.7),(340,.8),(60,.4)]  # 장식: 금·로즈골드·백금·청·자·녹·홍·은빛금
def look(star):
    if star<3: tier=0
    elif star<6: tier=1
    else: tier=2
    if star<10:
        fl={0:0,1:0,2:0,3:0,4:0,5:1,6:0,7:1,8:3,9:4}[star]
        mt={0:0,1:0,2:1,3:0,4:2,5:1,6:0,7:0,8:1,9:3}[star]
        tr={3:0,4:1,5:2,6:0,7:0,8:2,9:4}.get(star,0)
        glowk=1+0.12*star; rings=0
    else:
        k=star-10
        fl=k%len(FL); mt=(k//2)%len(MT); tr=(k//3)%len(TR)
        glowk=2.2+0.05*k; rings=min(3,1+k//10)
    return tier,fl,mt,tr,glowk,rings
def render(star):
    tier,fl,mt,tr,glowk,rings=look(star)
    a=tiers[tier].copy(); h,s,v,G,T,Wd,M=groups(a)
    out=a[...,:3].copy()
    # flame
    out[G]=rgb(np.full(G.sum(),FL[fl])+ (h[G]-25)*0.5, s[G]*FLS[fl], np.minimum(1,v[G]*min(1.25,0.9+0.1*glowk)))
    # trim
    th,ts=TR[tr]; out[T]=rgb(np.full(T.sum(),th)+(h[T]-45)*0.5, s[T]*ts, v[T]*(1.1 if ts<0.1 else 1))
    # metal tint
    mh,ms=MT[mt]
    if mh is not None:
        if ms==0: out[M]=rgb(h[M], s[M]*0.2, np.minimum(1,v[M]*1.35))
        else: out[M]=rgb(np.full(M.sum(),mh), np.maximum(s[M],ms), v[M]*1.05)
    img=np.dstack([out.clip(0,255),a[...,3]]).astype(np.uint8)
    im=Image.fromarray(img,'RGBA')
    # aura rings behind (★10+)
    base=Image.new('RGBA',im.size,(0,0,0,0))
    if rings:
        d=ImageDraw.Draw(base); cx,cy=63,62
        col=tuple(int(x) for x in rgb(np.array([FL[fl]]),np.array([0.7*FLS[fl]+0.1]),np.array([1.0]))[0])
        for r in range(rings):
            R=44+r*9
            d.ellipse([cx-R,cy-R,cx+R,cy+R],outline=col+(150-40*r,),width=1)
    base.alpha_composite(im); return base
cells=[0,1,2,3,4,5,6,7,8,9,10,11,12,13,15,18,21,25,30,40]
sc=2; cw=130*sc; chh=150*sc+22
cols=5; rows=(len(cells)+cols-1)//cols
sheet=Image.new('RGBA',(cols*cw,rows*chh),(38,44,54,255))
dr=ImageDraw.Draw(sheet)
try: font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',16)
except: font=None
for i,st in enumerate(cells):
    im=render(st).resize((W*sc,141*sc),Image.NEAREST)
    x=(i%cols)*cw; y=(i//cols)*chh
    sheet.alpha_composite(im,(x,y))
    tier=look(st)[0]+1
    dr.text((x+8,y+150*sc-6),f"★{st}  tier {['I','II','III'][tier-1]}{' +aura' if st>=10 else ''}",fill=(220,220,220,255),font=font)
sheet.save('evo_sheet.png'); print(sheet.size)
