// Optional asset-authoring tool. Requires ffmpeg and cwebp; the website itself has no dependencies.
// Reproducible 1-second illustrative cycle: atrial activation, AV delay, ventricular
// activation, then contraction and relaxation. Not a diagnostic simulation.
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync } from 'node:fs';
const W=640, H=640, FPS=50;
const run = (args, options={}) => {
  const r=spawnSync('ffmpeg',['-y','-loglevel','error',...args],{maxBuffer:16*1024*1024,...options});
  if(r.status!==0) throw new Error(r.stderr?.toString() || 'ffmpeg failed');
  return r.stdout;
};
const source=run(['-i','output/imagegen/heart-master.png','-vf',`scale=${W}:${H}`,'-f','rawvideo','-pix_fmt','rgb24','pipe:1']);
const tmp=mkdtempSync(join(tmpdir(),'abela-heart-'));
mkdirSync('src/assets',{recursive:true});
const smooth=(a,b,t)=>{const x=Math.max(0,Math.min(1,(t-a)/(b-a)));return x*x*(3-2*x);};
const beat=(t,a,b,c)=>smooth(a,b,t)*(1-smooth(b,c,t));
// Paths positioned over the visible conduction network in the generated base art.
const paths=[
 {start:0,end:.11,p:[[.286,.348],[.31,.382],[.36,.41],[.406,.432]]},
 {start:.025,end:.12,p:[[.286,.348],[.36,.35],[.44,.37],[.51,.405]]},
 {start:.20,end:.28,p:[[.406,.432],[.46,.47],[.49,.55],[.51,.67],[.56,.84]]},
 {start:.23,end:.30,p:[[.46,.48],[.53,.54],[.57,.65],[.56,.84]]},
 {start:.28,end:.36,p:[[.56,.84],[.64,.81],[.70,.73],[.72,.64],[.71,.56]]},
 {start:.28,end:.36,p:[[.56,.84],[.47,.78],[.38,.69],[.32,.58],[.31,.52]]}
];
function pulse(frame,x,y,strength){
 const radius=13;
 for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
  const px=Math.round(x+dx),py=Math.round(y+dy);if(px<0||px>=W||py<0||py>=H)continue;
  const d=dx*dx+dy*dy,glow=Math.exp(-d/36)*strength;
  const k=(py*W+px)*3;
  for(let c=0;c<3;c++)frame[k+c]=Math.min(255,frame[k+c]+glow*[105,220,255][c]);
 }
}
try {
 for(let f=0;f<FPS;f++){
  const t=f/FPS, frame=Buffer.alloc(W*H*3);
  const vent=beat(t,.25,.37,.68),atr=beat(t,.05,.12,.23);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   const nx=x/W,ny=y/H;
   // Localized deformation: upper atrial contraction precedes ventricular squeeze.
   const mask=Math.exp(-Math.pow((nx-.5)/.29,6))*Math.exp(-Math.pow((ny-.58)/.42,8));
   const ventricular=smooth(.43,.60,ny),amount=mask*(vent*.055*ventricular+atr*.025*(1-ventricular));
   const sx=Math.max(0,Math.min(W-2,(x-W*.51)/(1-amount)+W*.51));
   const sy=Math.max(0,Math.min(H-2,(y-H*.45)/(1-amount*.45)+H*.45));
   const ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy,k=(y*W+x)*3;
   for(let c=0;c<3;c++){
    const i=(iy*W+ix)*3+c;
    frame[k+c]=(source[i]*(1-fx)+source[i+3]*fx)*(1-fy)+(source[i+W*3]*(1-fx)+source[i+W*3+3]*fx)*fy;
   }
  }
  for(const path of paths){
   const phase=(t-path.start)/(path.end-path.start);
   if(phase<0||phase>1.5)continue;
   for(let tail=0;tail<16;tail++){
    const q=phase-tail*.018;if(q<0||q>1)continue;
    const pos=q*(path.p.length-1),i=Math.min(path.p.length-2,Math.floor(pos)),u=pos-i;
    const x=(path.p[i][0]*(1-u)+path.p[i+1][0]*u)*W;
    const y=(path.p[i][1]*(1-u)+path.p[i+1][1]*u)*H;
    pulse(frame,x,y,(1-tail/16)*.42);
   }
  }
  if(t>=.11&&t<.20)pulse(frame,W*.406,H*.432,.38);
  writeFileSync(join(tmp,`frame-${String(f).padStart(3,'0')}.ppm`),Buffer.concat([Buffer.from(`P6\n${W} ${H}\n255\n`),frame]));
 }
 run(['-framerate',String(FPS),'-i',join(tmp,'frame-%03d.ppm'),'-c:v','libx264','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart','-an','src/assets/heart-cycle.mp4']);
 run(['-framerate',String(FPS),'-i',join(tmp,'frame-%03d.ppm'),'-vf','fps=25,split[a][b];[a]palettegen=max_colors=192[p];[b][p]paletteuse=dither=sierra2_4a','-loop','0','src/assets/heart-cycle.gif']);
 const poster=spawnSync('cwebp',['-quiet','-q','85','-resize','640','640','output/imagegen/heart-master.png','-o','src/assets/heart-poster.webp']);
 if(poster.status!==0) throw new Error('cwebp failed');
} finally { rmSync(tmp,{recursive:true,force:true}); }
console.log('Created heart-cycle.mp4, heart-cycle.gif, and heart-poster.webp');
