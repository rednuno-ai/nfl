// Canvas artwork adapted from the user's gridiron-play-engine-demo.html.
// No DOM globals, random game outcomes, timers or persistence in this renderer.
import { ballHeight, clamp, pathValue, type Point, type ReplayPlayer, type ReplayScene } from './replayScene';

export function createReplayRenderer(context: CanvasRenderingContext2D) {
  const ctx = context;
  const FIELD_LEN = 120, FIELD_WID = 53.3, TEAM_HOME = 'home';
  let cw = 0, ch = 0, homeName = '', awayName = '';
  let scene: ReplayScene;
  const seededRand = (seed: number) => { const value = Math.sin(seed*12.9898)*43758.5453; return value-Math.floor(value); };
  const TURF_GRAIN = Array.from({length:260},(_,i)=>({x:seededRand(i*3.1)*120,y:seededRand(i*3.1+1)*53.3,a:.03+seededRand(i*3.1+2)*.05}));
  function camMetrics(halfWindow: number) {
    const scale = Math.min(cw/(halfWindow*2), ch/62);
    return {scale,marginY:(ch-FIELD_WID*scale)/2};
  }
  function drawStadiumBackdrop(marginY: number){
    var avail = Math.max(0, marginY);
    if (avail < 6) return;
    var bandH = clamp(avail, 6, 60);
    ctx.fillStyle = '#060b12';
    ctx.fillRect(0,0,cw,bandH);
    ctx.fillRect(0,ch-bandH,cw,bandH);

    [0,1].forEach(function(edge){
      var baseY = edge ? ch-bandH : bandH;
      var dir = edge ? -1 : 1;
      [0.55,0.75,0.95].forEach(function(rowFrac, ri){
        var rowY = baseY - dir*bandH*(1-rowFrac);
        var headR = clamp(cw/170,2.2,4.2) * (1 - ri*0.16);
        var gapX = headR*2.35;
        var offset = (ri%2)*gapX*0.5;
        for (var x = -offset; x < cw+gapX; x += gapX){
          var seed = x*1.37 + ri*91 + edge*401;
          var isFan = seededRand(seed+4) > 0.8;
          var shirtShade = 55 + Math.floor(seededRand(seed)*70) + ri*10;
          var shirt = isFan ? (seededRand(seed+5)>0.5?HOME_COL:AWAY_COL) : ('rgb('+shirtShade+','+(shirtShade+7)+','+(shirtShade+17)+')');
          var skinTones = ['#c98a5e','#8d5a3a','#e0b28a','#6b4226'];
          var skin = skinTones[Math.floor(seededRand(seed+7)*4)];
          var py = rowY + (seededRand(seed+2)-0.5)*headR*0.8;
          ctx.globalAlpha = 0.5 + ri*0.18;
          ctx.beginPath();
          ctx.ellipse(x, py + dir*headR*1.15, headR*1.15, headR*0.95, 0, 0, Math.PI*2);
          ctx.fillStyle = shirt;
          ctx.fill();
          if (seededRand(seed+8) > 0.93){
            ctx.strokeStyle = shirt;
            ctx.lineWidth = Math.max(0.5, headR*0.35);
            ctx.beginPath(); ctx.moveTo(x-headR*0.9, py+dir*headR*0.6); ctx.lineTo(x-headR*1.7, py-dir*headR*0.9); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x+headR*0.9, py+dir*headR*0.6); ctx.lineTo(x+headR*1.7, py-dir*headR*0.9); ctx.stroke();
          }
          ctx.beginPath();
          ctx.arc(x, py, headR*0.72, 0, Math.PI*2);
          ctx.fillStyle = skin;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      });
      ctx.strokeStyle = 'rgba(210,215,225,0.28)';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0, baseY); ctx.lineTo(cw, baseY); ctx.stroke();
    });

    [0.1,0.5,0.9].forEach(function(fx){
      var gx = cw*fx, gy = bandH*0.3;
      var glow = ctx.createRadialGradient(gx,gy,0,gx,gy,cw*0.15);
      glow.addColorStop(0,'rgba(255,247,225,0.4)');
      glow.addColorStop(1,'rgba(255,247,225,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(gx-cw*0.15,0,cw*0.3,bandH*1.7);
    });
  }

  function drawGoalPost(worldX: number, worldY: number, camX: number, halfWindow: number){
    var m = camMetrics(halfWindow);
    var scale = m.scale;
    var bx = cw/2 - camX*scale + worldX*scale;
    var by = worldY*scale + m.marginY;
    if (bx < -60 || bx > cw+60) return;
    var poleH = clamp(scale*2.6, 13, 38);
    var armRise = clamp(scale*1.0, 5, 13);
    var crossW = clamp(scale*5.8, 20, 72);
    var uprightH = clamp(scale*10, 42, 128);
    var topY = by - poleH;
    var barY = topY - armRise;

    ctx.beginPath();
    ctx.ellipse(bx,by,scale*0.6,scale*0.24,0,0,Math.PI*2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();

    var poleW = Math.max(1.5, scale*0.115);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(bx-poleW*0.95, by);
    ctx.lineTo(bx-poleW*0.62, topY);
    ctx.lineTo(bx+poleW*0.62, topY);
    ctx.lineTo(bx+poleW*0.95, by);
    ctx.closePath();
    var poleGrad = ctx.createLinearGradient(bx-poleW,0,bx+poleW,0);
    poleGrad.addColorStop(0,'#a37700');
    poleGrad.addColorStop(0.35,'#ffcf1f');
    poleGrad.addColorStop(0.55,'#fff3b0');
    poleGrad.addColorStop(1,'#c99a00');
    ctx.fillStyle = poleGrad;
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    var padRect = [bx-poleW*1.15, by-scale*1.05, poleW*2.3, scale*1.05];
    if (ctx.roundRect) ctx.roundRect(padRect[0],padRect[1],padRect[2],padRect[3],poleW*0.55); else ctx.rect(padRect[0],padRect[1],padRect[2],padRect[3]);
    ctx.fillStyle = '#ffcc00';
    ctx.fill();
    ctx.strokeStyle = '#8a6400';
    ctx.lineWidth = Math.max(0.6, poleW*0.15);
    ctx.stroke();

    function tube(x1: number,y1: number,x2: number,y2: number,w: number,curve: boolean){
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#a37700';
      ctx.lineWidth = w*1.32;
      ctx.beginPath();
      if (curve){ ctx.moveTo(x1,y1); ctx.quadraticCurveTo(x1,y1-(y1-y2)*0.55,x2,y2); } else { ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); }
      ctx.stroke();
      ctx.strokeStyle = '#ffcf1f';
      ctx.lineWidth = w;
      ctx.beginPath();
      if (curve){ ctx.moveTo(x1,y1); ctx.quadraticCurveTo(x1,y1-(y1-y2)*0.55,x2,y2); } else { ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = Math.max(0.5, w*0.2);
      ctx.beginPath();
      if (curve){ ctx.moveTo(x1-w*0.18,y1); ctx.quadraticCurveTo(x1-w*0.18,y1-(y1-y2)*0.55,x2-w*0.18,y2); } else { ctx.moveTo(x1-w*0.18,y1); ctx.lineTo(x2-w*0.18,y2); }
      ctx.stroke();
    }

    function joint(x: number,y: number,w: number){
      ctx.beginPath(); ctx.arc(x,y,w*0.62,0,Math.PI*2);
      ctx.fillStyle = '#ffcf1f'; ctx.fill();
      ctx.strokeStyle = '#a37700'; ctx.lineWidth = Math.max(0.4,w*0.16); ctx.stroke();
    }

    tube(bx,topY,bx-crossW/2,barY,poleW,true);
    tube(bx,topY,bx+crossW/2,barY,poleW,true);
    tube(bx-crossW/2,barY,bx+crossW/2,barY,poleW*1.05,false);
    tube(bx-crossW/2,barY,bx-crossW/2,barY-uprightH,poleW*0.82,false);
    tube(bx+crossW/2,barY,bx+crossW/2,barY-uprightH,poleW*0.82,false);
    joint(bx,topY,poleW*1.2);
    joint(bx-crossW/2,barY,poleW*1.05);
    joint(bx+crossW/2,barY,poleW*1.05);
    [-1,1].forEach(function(s){
      ctx.beginPath();
      ctx.arc(bx+s*crossW/2, barY-uprightH, poleW*0.65, 0, Math.PI*2);
      ctx.fillStyle = '#ffcc00';
      ctx.fill();
      ctx.strokeStyle = '#a37700';
      ctx.lineWidth = Math.max(0.4, poleW*0.14);
      ctx.stroke();
    });
  }

  function drawField(camX: number, halfWindow: number){
    var m = camMetrics(halfWindow);
    var scale = m.scale;
    ctx.save();
    ctx.translate(cw/2 - camX*scale, m.marginY);
    ctx.scale(scale, scale);

    var stripeW = 5;
    for (var yd = 0; yd < FIELD_LEN; yd += stripeW){
      ctx.fillStyle = (Math.floor(yd/stripeW)%2===0) ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.05)';
      ctx.fillRect(yd, 0, stripeW, FIELD_WID);
    }
    var spot = ctx.createRadialGradient(camX,FIELD_WID/2,4,camX,FIELD_WID/2,34);
    spot.addColorStop(0,'rgba(255,244,214,0.12)');
    spot.addColorStop(1,'rgba(255,244,214,0)');
    ctx.fillStyle = spot;
    ctx.fillRect(camX-40,-2,80,FIELD_WID+4);

    TURF_GRAIN.forEach(function(g){
      if (g.x < camX-halfWindow-2 || g.x > camX+halfWindow+2) return;
      ctx.fillStyle = 'rgba(10,30,16,' + g.a + ')';
      ctx.fillRect(g.x, g.y, 0.5, 0.5);
    });

    ctx.fillStyle = 'rgba(248,121,77,0.10)';
    ctx.fillRect(0,0,10,FIELD_WID);
    ctx.fillStyle = 'rgba(58,160,214,0.10)';
    ctx.fillRect(110,0,10,FIELD_WID);
    if (camX-halfWindow < 12){
      ctx.save();
      ctx.translate(5, FIELD_WID/2);
      ctx.rotate(-Math.PI/2);
      ctx.font = '700 5px -apple-system, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.textAlign = 'center';
      ctx.fillText(homeName, 0, 0);
      ctx.restore();
    }
    if (camX+halfWindow > 108){
      ctx.save();
      ctx.translate(115, FIELD_WID/2);
      ctx.rotate(Math.PI/2);
      ctx.font = '700 5px -apple-system, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.textAlign = 'center';
      ctx.fillText(awayName, 0, 0);
      ctx.restore();
    }

    ctx.strokeStyle = 'rgba(233,239,230,0.55)';
    ctx.lineWidth = 0.12;
    for (var x=10; x<=110; x+=5){
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,FIELD_WID); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(233,239,230,0.85)';
    ctx.lineWidth = 0.22;
    ctx.beginPath(); ctx.moveTo(10,0); ctx.lineTo(10,FIELD_WID); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(110,0); ctx.lineTo(110,FIELD_WID); ctx.stroke();

    ctx.strokeStyle = 'rgba(233,239,230,0.35)';
    ctx.lineWidth = 0.08;
    for (var hx=11; hx<110; hx++){
      ctx.beginPath(); ctx.moveTo(hx,17.8); ctx.lineTo(hx,18.6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hx,34.7); ctx.lineTo(hx,35.5); ctx.stroke();
    }

    ctx.fillStyle = 'rgba(233,239,230,0.55)';
    var fontSize = 3.2;
    ctx.font = fontSize + 'px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    for (var nx=20; nx<=100; nx+=10){
      var num = nx<=60 ? nx-10 : 110-nx;
      ctx.save();
      ctx.translate(nx, 8);
      ctx.fillText(String(num), 0, 0);
      ctx.restore();
      ctx.save();
      ctx.translate(nx, FIELD_WID-6);
      ctx.rotate(Math.PI);
      ctx.fillText(String(num), 0, 0);
      ctx.restore();
    }

    ctx.strokeStyle = 'rgba(248,121,77,0.9)';
    ctx.lineWidth = 0.15;
    ctx.beginPath(); ctx.moveTo(scene.los,0); ctx.lineTo(scene.los,FIELD_WID); ctx.stroke();
    var firstDownX = scene.firstDown;
    ctx.strokeStyle = 'rgba(255,214,10,0.85)';
    ctx.beginPath(); ctx.moveTo(firstDownX,0); ctx.lineTo(firstDownX,FIELD_WID); ctx.stroke();

    ctx.restore();
  }

  var HOME_COL = '#f8794d', HOME_DARK = '#a84e2c', AWAY_COL = '#3aa0d6', AWAY_DARK = '#25689a';

  var ROLE_SCALE: Record<string, number> = { OL:1.22, DL:1.2, QB:1.0, RB:0.95, TE:1.05, WR:0.88, CB:0.9, S:0.92, LB:1.02 };

  function drawPlayer(p: ReplayPlayer, pos: Point, prevPos: Point, camX: number, halfWindow: number, isBallCarrier: boolean, tSec: number){
    var m = camMetrics(halfWindow);
    var scale = m.scale;
    var sx = cw/2 - camX*scale + pos.x*scale;
    var sy = pos.y*scale + m.marginY;
    var r = clamp(scale*0.74, 4.5, 13) * (ROLE_SCALE[p.role] || 1);
    var col = p.team===TEAM_HOME ? HOME_COL : AWAY_COL;
    var dark = p.team===TEAM_HOME ? HOME_DARK : AWAY_DARK;
    var pants = p.team===TEAM_HOME ? '#e7e2d8' : '#dfe6ec';

    var dx = pos.x - prevPos.x, dy = pos.y - prevPos.y;
    var moving = (dx*dx+dy*dy) > 0.00002;
    var angle = moving ? Math.atan2(dy,dx) : (p.team===TEAM_HOME ? 0 : Math.PI);
    var phase = tSec*26 + p.x*3;
    var stride = Math.sin(phase) * (moving ? r*0.36 : r*0.05);
    var armSwing = Math.cos(phase) * (moving ? r*0.28 : r*0.04);
    var shF = r*0.55, hipB = -r*0.5, shW = r*0.78, hipW = r*0.5;

    ctx.beginPath();
    ctx.ellipse(sx, sy+r*0.78, r*1.12, r*0.42, 0, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0,0,0,0.36)';
    ctx.fill();

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(angle);

    [1,-1].forEach(function(side){
      var hipX = hipB+r*0.1, hipY = side*hipW*0.4;
      var footX = hipB-r*0.5 + (side>0 ? -Math.abs(stride) : Math.abs(stride))*0.45;
      var footY = side*hipW*0.4 + (side>0?stride:-stride)*0.55;
      var midX = (hipX+footX)/2, midY = (hipY+footY)/2;
      var bend = clamp(Math.abs(stride), 0, r*0.4) * 0.55;
      var kneeX = midX + r*0.12, kneeY = midY + side*bend;

      ctx.strokeStyle = pants;
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1.4, r*0.3);
      ctx.beginPath(); ctx.moveTo(hipX,hipY); ctx.lineTo(kneeX,kneeY); ctx.stroke();
      ctx.strokeStyle = '#2a2f38';
      ctx.lineWidth = Math.max(1.0, r*0.19);
      ctx.beginPath(); ctx.moveTo(kneeX,kneeY); ctx.lineTo(footX,footY); ctx.stroke();

      ctx.save();
      ctx.translate(footX,footY);
      ctx.rotate(Math.atan2(footY-kneeY, footX-kneeX));
      ctx.fillStyle = '#0c0e12';
      ctx.beginPath();
      ctx.moveTo(-r*0.16,-r*0.09); ctx.lineTo(r*0.2,-r*0.07); ctx.lineTo(r*0.22,0); ctx.lineTo(r*0.2,r*0.07); ctx.lineTo(-r*0.16,r*0.09);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = Math.max(0.3, r*0.03);
      for (var cst=-1; cst<=1; cst++){
        ctx.beginPath(); ctx.moveTo(cst*r*0.08, -r*0.09); ctx.lineTo(cst*r*0.08, r*0.09); ctx.stroke();
      }
      ctx.restore();
    });

    ctx.strokeStyle = dark;
    ctx.lineWidth = Math.max(1, r*0.2);
    ctx.beginPath(); ctx.moveTo(shF-r*0.2, -shW*0.55); ctx.lineTo(shF-r*0.55 - armSwing*0.3, -shW*0.75 + armSwing*0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(shF-r*0.2, shW*0.55); ctx.lineTo(shF-r*0.55 + armSwing*0.3, shW*0.75 - armSwing*0.6); ctx.stroke();
    ctx.fillStyle = '#c98a5e';
    ctx.beginPath(); ctx.arc(shF-r*0.55-armSwing*0.3, -shW*0.75+armSwing*0.6, r*0.12, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(shF-r*0.55+armSwing*0.3, shW*0.75-armSwing*0.6, r*0.12, 0, Math.PI*2); ctx.fill();

    var bodyGrad = ctx.createLinearGradient(hipB,0,shF,0);
    bodyGrad.addColorStop(0, dark);
    bodyGrad.addColorStop(0.5, col);
    bodyGrad.addColorStop(1, col);
    ctx.beginPath();
    ctx.moveTo(shF, -shW);
    ctx.quadraticCurveTo(shF+r*0.32, 0, shF, shW);
    ctx.quadraticCurveTo(hipB+r*0.1, hipW+r*0.05, hipB, hipW);
    ctx.quadraticCurveTo(hipB-r*0.12, 0, hipB, -hipW);
    ctx.quadraticCurveTo(hipB+r*0.1, -hipW-r*0.05, shF, -shW);
    ctx.closePath();
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = Math.max(0.6, r*0.07);
    ctx.stroke();

    ['#ffffff','#ffffff'].forEach(function(c,si){
      ctx.beginPath();
      ctx.ellipse(shF-r*0.18, si?shW-r*0.18:-(shW-r*0.18), r*0.22, r*0.12, 0, 0, Math.PI*2);
      ctx.fillStyle = c;
      ctx.globalAlpha = 0.9;
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    if (r > 6){
      ctx.fillStyle = dark;
      ctx.font = '700 ' + Math.round(r*0.42) + 'px -apple-system, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      [-1,1].forEach(function(side){
        ctx.save(); ctx.translate(shF-r*0.18, side*(shW-r*0.18)); ctx.rotate(-angle); ctx.fillText(String(p.num), 0, 0.5); ctx.restore();
      });
    }

    var neckX = shF - r*0.05;
    ctx.beginPath();
    ctx.ellipse(neckX, 0, r*0.22, r*0.3, 0, 0, Math.PI*2);
    ctx.fillStyle = dark;
    ctx.fill();

    var headX = shF + r*0.22;
    var helmetGrad = ctx.createRadialGradient(headX-r*0.1,-r*0.12,r*0.05,headX,0,r*0.46);
    helmetGrad.addColorStop(0, '#2c333d');
    helmetGrad.addColorStop(1, dark);
    ctx.beginPath();
    ctx.arc(headX, 0, r*0.44, 0, Math.PI*2);
    ctx.fillStyle = helmetGrad;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(headX, 0, r*0.44, -1.15, 1.15);
    ctx.strokeStyle = col;
    ctx.lineWidth = Math.max(0.6, r*0.09);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(15,17,20,0.95)';
    ctx.lineWidth = Math.max(0.32, r*0.04);
    for (let m=-1;m<=1;m++){
      ctx.beginPath();
      ctx.moveTo(headX+r*0.32, m*r*0.14);
      ctx.lineTo(headX+r*0.62, m*r*0.14);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(headX+r*0.32,-r*0.14); ctx.lineTo(headX+r*0.64,0); ctx.lineTo(headX+r*0.32,r*0.14); ctx.stroke();
    ctx.beginPath();
    ctx.arc(headX+r*0.16, -r*0.16, r*0.1, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fill();

    if (isBallCarrier){
      ctx.beginPath();
      ctx.ellipse(0, 0, r*1.55, r*1.08, 0, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(255,214,10,0.88)';
      ctx.lineWidth = Math.max(1, r*0.15);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBall(pos: Point, h: number, camX: number, halfWindow: number, tSec: number){
    var m = camMetrics(halfWindow);
    var scale = m.scale;
    var sx = cw/2 - camX*scale + pos.x*scale;
    var sy = pos.y*scale + m.marginY;
    var lift = h*scale*0.6;

    ctx.beginPath();
    ctx.ellipse(sx, sy+3, Math.max(2,scale*0.3), Math.max(1,scale*0.12), 0, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();

    ctx.save();
    ctx.translate(sx, sy - lift);
    ctx.rotate((tSec||0) * (h>0.3 ? 14 : 3));
    ctx.beginPath();
    ctx.ellipse(0,0, Math.max(3,scale*0.32), Math.max(2,scale*0.19), 0, 0, Math.PI*2);
    ctx.fillStyle = '#7a4324';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = Math.max(0.5, scale*0.022);
    ctx.beginPath();
    ctx.moveTo(-scale*0.16,0); ctx.lineTo(scale*0.16,0); ctx.stroke();
    for (var lc=-2; lc<=2; lc++){
      ctx.beginPath();
      ctx.moveTo(lc*scale*0.055, -scale*0.03);
      ctx.lineTo(lc*scale*0.055, scale*0.03);
      ctx.stroke();
    }
    ctx.restore();
  }


  return (next: ReplayScene, t: number, width: number, height: number, home: string, away: string, playerPosition: string, playerName: string) => {
    scene=next; cw=width; ch=height; homeName=home.slice(0,12); awayName=away.slice(0,12);
    const ball=pathValue(scene.ball,t);
    const zoom=54-18*Math.sin(t*Math.PI/2);
    const cameraX=clamp(ball.x,22,98);
    ctx.clearRect(0,0,cw,ch);
    const gradient=ctx.createLinearGradient(0,0,0,ch);
    gradient.addColorStop(0,'#0d1b2e'); gradient.addColorStop(.4,'#1d4a30'); gradient.addColorStop(1,'#0b2417');
    ctx.fillStyle=gradient; ctx.fillRect(0,0,cw,ch);
    drawField(cameraX,zoom);
    drawStadiumBackdrop(camMetrics(zoom).marginY);
    drawGoalPost(-.6,FIELD_WID/2,cameraX,zoom);
    drawGoalPost(120.6,FIELD_WID/2,cameraX,zoom);
    for (const player of scene.players) {
      const pos=pathValue(player.path,t), previous=pathValue(player.path,Math.max(0,t-.02));
      drawPlayer(player,pos,previous,cameraX,zoom,player.id===scene.carrier&&t>=scene.catchT,t*4.2);
    }
    drawBall(ball,ballHeight(scene,t),cameraX,zoom,t*4.2);
    const controlled = scene.players.find(p => p.team === 'home' && p.role === playerPosition);
    if (controlled) {
      const pos = pathValue(controlled.path,t), metrics = camMetrics(zoom);
      const x = cw/2 + (pos.x-cameraX)*metrics.scale, y = pos.y*metrics.scale+metrics.marginY;
      ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,Math.max(6,metrics.scale*1.1),0,Math.PI*2);ctx.stroke();
      ctx.font='600 12px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
      const label=playerName.slice(0,18), w=ctx.measureText(label).width+12, lx=clamp(x,w/2,cw-w/2);
      ctx.fillStyle='#101722';ctx.fillRect(lx-w/2,y+13,w,20);ctx.fillStyle='#fff';ctx.fillText(label,lx,y+23);
    }
  };
}
