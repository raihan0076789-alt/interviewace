"use client";

import { Mic, Eye, Brain, Zap } from "lucide-react";
import LogoIcon from "@/components/LogoIcon";

interface AuthLayoutProps {
  children: React.ReactNode;
  tagline: string;
  taglineAccent: string;
  subtitle: string;
}

// Neural network constellation nodes + edges
const NODES = [
  { x: 60,  y: 100 }, { x: 170, y: 65  }, { x: 290, y: 110 },
  { x: 80,  y: 210 }, { x: 210, y: 185 }, { x: 330, y: 175 },
  { x: 55,  y: 330 }, { x: 175, y: 295 }, { x: 310, y: 260 },
  { x: 100, y: 440 }, { x: 250, y: 410 }, { x: 355, y: 380 },
  { x: 140, y: 530 }, { x: 280, y: 500 }, { x: 370, y: 470 },
];
const EDGES = [
  [0,1],[1,2],[0,3],[1,4],[2,5],[3,4],[4,5],
  [3,6],[4,7],[5,8],[6,7],[7,8],[7,10],[8,11],
  [9,10],[10,11],[9,12],[10,13],[11,14],[12,13],[13,14],
];

// Small bright floating dots
const DOTS = [
  { x:"18%", y:"22%", s:3, c:"#34D399", dur:6,  del:0   },
  { x:"72%", y:"15%", s:2, c:"#14B8A6", dur:8,  del:1.2 },
  { x:"42%", y:"48%", s:4, c:"#10B981", dur:7,  del:0.4 },
  { x:"85%", y:"68%", s:2, c:"#34D399", dur:9,  del:2   },
  { x:"12%", y:"75%", s:3, c:"#14B8A6", dur:5,  del:1.5 },
  { x:"55%", y:"32%", s:2, c:"#10B981", dur:8,  del:0.7 },
  { x:"30%", y:"85%", s:3, c:"#6EE7B7", dur:6,  del:2.8 },
  { x:"91%", y:"38%", s:2, c:"#34D399", dur:7,  del:0.9 },
  { x:"65%", y:"58%", s:3, c:"#14B8A6", dur:9,  del:1.7 },
  { x:"24%", y:"55%", s:2, c:"#10B981", dur:5,  del:3.2 },
  { x:"78%", y:"82%", s:3, c:"#6EE7B7", dur:7,  del:0.3 },
  { x:"48%", y:"12%", s:2, c:"#34D399", dur:8,  del:1.9 },
];

const FEATURES = [
  { icon: Mic,   color: "#10B981", text: "Real-time voice analysis by Aira"       },
  { icon: Eye,   color: "#14B8A6", text: "Eye contact & posture tracking"           },
  { icon: Brain, color: "#34D399", text: "Personalised AI feedback & scoring"       },
  { icon: Zap,   color: "#10B981", text: "Resume-based personalised questions"      },
];

const STATS = [
  ["98%",  "Satisfaction"],
  ["10k+", "Interviews"  ],
  ["4.9★", "User Rating" ],
];

const AVATAR_COLORS = ["#8B5CF6","#10B981","#F59E0B","#EF4444"];
const AVATAR_LABELS = ["M","R","A","K"];

export default function AuthLayout({
  children, tagline, taglineAccent, subtitle,
}: AuthLayoutProps) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "#041B1A" }}>

      {/* ── Global keyframes ───────────────────────────────────────────────── */}
      <style>{`
        @keyframes floatDot {
          0%,100% { transform:translate(0,0) scale(1); opacity:.85; }
          25%      { transform:translate(7px,-12px) scale(1.15); opacity:1; }
          50%      { transform:translate(-5px,-6px) scale(.9);  opacity:.6; }
          75%      { transform:translate(4px,9px)  scale(1.05); opacity:.9; }
        }
        @keyframes waveBreath {
          0%,100% { opacity:.65; transform:scaleY(1); }
          50%      { opacity:1;   transform:scaleY(1.04); }
        }
        @keyframes rotateRing {
          from { transform:rotate(0deg); }
          to   { transform:rotate(360deg); }
        }
        @keyframes rotateRingR {
          from { transform:rotate(0deg); }
          to   { transform:rotate(-360deg); }
        }
        @keyframes nodeGlow {
          0%,100% { opacity:.35; r:2; }
          50%      { opacity:.9;  r:3.2; }
        }
        @keyframes aLeft {
          from { opacity:0; transform:translateX(-28px); }
          to   { opacity:1; transform:translateX(0); }
        }
        @keyframes aRight {
          from { opacity:0; transform:translateX(28px); }
          to   { opacity:1; transform:translateX(0); }
        }
        @keyframes aUp {
          from { opacity:0; transform:translateY(18px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        /* kept from globals for orb float */
        @keyframes orbFloat  {
          0%,100%{transform:translate(0,0) scale(1); opacity:.11;}
          33%    {transform:translate(38px,-28px) scale(1.07); opacity:.17;}
          66%    {transform:translate(-22px,18px)  scale(.94);  opacity:.09;}
        }
        @keyframes orbFloatR {
          0%,100%{transform:translate(0,0) scale(1); opacity:.09;}
          33%    {transform:translate(-32px,22px) scale(.93);   opacity:.14;}
          66%    {transform:translate(28px,-18px)  scale(1.05); opacity:.07;}
        }
        @keyframes orbSlow {
          0%,100%{transform:translate(0,0) scale(1);    opacity:.06;}
          50%    {transform:translate(18px,-35px) scale(1.1); opacity:.12;}
        }
      `}</style>

      {/* ═══════════════════════════════════════════════════════════════════
          LEFT PANEL — hidden on mobile, 50% on desktop
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:block" style={{
        width: "50%", position: "relative", overflow: "hidden", flexShrink: 0,
        background: "linear-gradient(155deg,#020d0c 0%,#041B1A 42%,#062d27 100%)",
      }}>

        {/* Gradient orbs */}
        {[
          { w:520,h:520,t:"-18%",l:"-18%",c:"rgba(16,185,129,1)",  blur:100, op:.11, anim:"orbFloat  14s ease-in-out infinite" },
          { w:420,h:420,b:"2%",  r:"-12%",c:"rgba(20,184,166,1)",  blur:90,  op:.10, anim:"orbFloatR 18s ease-in-out infinite" },
          { w:320,h:320,t:"38%", l:"35%", c:"rgba(52,211,153,1)",  blur:85,  op:.07, anim:"orbSlow   22s ease-in-out infinite" },
          { w:240,h:240,t:"12%", r:"8%",  c:"rgba(16,185,129,1)",  blur:70,  op:.08, anim:"orbFloat  11s ease-in-out infinite 4s" },
        ].map((o,i) => (
          <div key={i} style={{
            position:"absolute", borderRadius:"50%",
            width:o.w, height:o.h,
            ...(o.t !== undefined ? {top:o.t}:{bottom:o.b}),
            ...(o.l !== undefined ? {left:o.l}:{right:o.r}),
            background:`radial-gradient(circle,${o.c},transparent 70%)`,
            filter:`blur(${o.blur}px)`, opacity:o.op,
            animation:o.anim,
          }}/>
        ))}

        {/* Dot-grid */}
        <div style={{
          position:"absolute",inset:0,
          backgroundImage:"radial-gradient(rgba(16,185,129,0.25) 1px,transparent 1px)",
          backgroundSize:"36px 36px",opacity:.35,
        }}/>

        {/* Neural network SVG */}
        <svg style={{ position:"absolute",inset:0,width:"100%",height:"100%" }}
          viewBox="0 0 420 600" preserveAspectRatio="xMidYMid slice">
          {EDGES.map(([a,b],i)=>(
            <line key={i}
              x1={NODES[a].x} y1={NODES[a].y}
              x2={NODES[b].x} y2={NODES[b].y}
              stroke="rgba(16,185,129,0.13)" strokeWidth=".9"/>
          ))}
          {NODES.map((n,i)=>(
            <circle key={i} cx={n.x} cy={n.y} r="2.4"
              fill="rgba(16,185,129,0.55)"
              style={{animation:`nodeGlow ${2.5+(i%3)*.8}s ease-in-out infinite ${(i*.28)%2.2}s`}}/>
          ))}
        </svg>

        {/* Small bright dots */}
        {DOTS.map((d,i)=>(
          <div key={i} style={{
            position:"absolute", left:d.x, top:d.y,
            width:d.s, height:d.s, borderRadius:"50%",
            background:d.c,
            boxShadow:`0 0 ${d.s*4}px ${d.s*1.5}px ${d.c}88`,
            animation:`floatDot ${d.dur}s ease-in-out infinite ${d.del}s`,
          }}/>
        ))}

        {/* Animated rings */}
        {[
          { sz:130, t:"52%", r:"6%",  dur:"22s", op:.18 },
          { sz:175, t:"calc(52% - 22px)", r:"calc(6% - 22px)", dur:"34s", op:.10, rev:true },
          { sz:70,  t:"22%", l:"8%",  dur:"18s", op:.15 },
        ].map((r,i)=>(
          <div key={i} style={{
            position:"absolute", borderRadius:"50%",
            width:r.sz, height:r.sz,
            ...(r.t ?{top:r.t}:{}),
            ...(r.r ?{right:r.r}:{}),
            ...(r.l ?{left:r.l}:{}),
            border:`1px solid rgba(16,185,129,${r.op})`,
            animation:`${r.rev?"rotateRingR":"rotateRing"} ${r.dur} linear infinite`,
          }}>
            {i===0 && (
              <div style={{
                position:"absolute",top:"10%",left:"50%",
                width:5,height:5,borderRadius:"50%",
                background:"#34D399",transform:"translateX(-50%)",
                boxShadow:"0 0 10px 3px rgba(52,211,153,.85)",
              }}/>
            )}
          </div>
        ))}

        {/* SVG wave at bottom */}
        <div style={{
          position:"absolute",bottom:0,left:0,right:0,
          animation:"waveBreath 7s ease-in-out infinite",
        }}>
          <svg viewBox="0 0 1200 200" preserveAspectRatio="none"
            style={{ width:"100%", height:180, display:"block" }}>
            <path
              d="M0,140 C150,75 310,185 470,140 C630,95 790,185 950,140 C1080,105 1150,158 1200,140 L1200,200 L0,200 Z"
              fill="rgba(16,185,129,0.055)"/>
            <path
              d="M0,158 C200,95 420,210 620,158 C820,106 1020,210 1200,158"
              stroke="rgba(16,185,129,0.22)" strokeWidth="1.6" fill="none"/>
            <path
              d="M0,175 C170,118 350,228 540,175 C730,122 910,228 1080,175 C1155,152 1200,168 1200,175"
              stroke="rgba(20,184,166,0.13)" strokeWidth="1.1" fill="none"/>
            <path
              d="M0,188 C250,145 500,218 750,188 C1000,158 1100,205 1200,188"
              stroke="rgba(52,211,153,0.08)" strokeWidth="0.8" fill="none"/>
          </svg>
        </div>

        {/* Top-right shimmer line */}
        <div style={{
          position:"absolute",top:0,left:0,right:0,height:1,
          background:"linear-gradient(90deg,transparent 0%,rgba(16,185,129,0.45) 50%,transparent 100%)",
        }}/>

        {/* ── Left panel content ── */}
        <div style={{
          position:"relative",zIndex:10,
          display:"flex",flexDirection:"column",
          height:"100%",
          padding:"2.75rem 3.25rem",
          animation:"aLeft .75s ease-out",
        }}>

          {/* Logo */}
          <div style={{ display:"flex",alignItems:"center",gap:".75rem" }}>
            <LogoIcon size={40}/>
            <span style={{ fontWeight:800,fontSize:"1.125rem",letterSpacing:"-.02em" }}>
              <span style={{ color:"#fff" }}>Interview</span>
              <span style={{ color:"#F97316" }}>Ace</span>
            </span>
          </div>

          {/* Main content block */}
          <div style={{ flex:1,display:"flex",flexDirection:"column",justifyContent:"center",paddingTop:"1rem" }}>

            {/* Label */}
            <div style={{
              display:"flex",alignItems:"center",gap:".5rem",
              marginBottom:"1rem",
              animation:"aLeft .5s ease-out .1s both",
            }}>
              <span style={{
                display:"inline-block",width:22,height:1.5,
                background:"linear-gradient(90deg,#10B981,#14B8A6)",borderRadius:2,
              }}/>
              <span style={{
                fontSize:".65rem",fontWeight:700,letterSpacing:".14em",
                textTransform:"uppercase",color:"#10B981",
              }}>
                AI-Powered Interview Coach
              </span>
            </div>

            {/* Tagline */}
            <h1 style={{
              fontSize:"clamp(2rem,3.2vw,2.75rem)",
              fontWeight:800,lineHeight:1.13,
              color:"#fff",marginBottom:"1.1rem",letterSpacing:"-.03em",
              animation:"aLeft .55s ease-out .15s both",
            }}>
              {tagline}{" "}
              <span style={{
                backgroundImage:"linear-gradient(135deg,#34D399 0%,#2DD4BF 60%,#14B8A6 100%)",
                WebkitBackgroundClip:"text",
                WebkitTextFillColor:"transparent",backgroundClip:"text",
              }}>
                {taglineAccent}
              </span>
            </h1>

            {/* Subtitle */}
            <p style={{
              fontSize:".875rem",lineHeight:1.7,color:"rgba(110,231,183,.5)",
              marginBottom:"2rem",maxWidth:"320px",
              animation:"aLeft .55s ease-out .2s both",
            }}>
              {subtitle}
            </p>

            {/* Feature list */}
            <div style={{ display:"flex",flexDirection:"column",gap:".625rem",marginBottom:"2.25rem" }}>
              {FEATURES.map(({ icon: Icon, color, text }, i) => (
                <div key={i} style={{
                  display:"flex",alignItems:"center",gap:".75rem",
                  animation:`aLeft .5s ease-out ${.25+i*.08}s both`,
                }}>
                  <div style={{
                    width:30,height:30,borderRadius:".5rem",flexShrink:0,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    background:"rgba(16,185,129,.09)",
                    border:`1px solid rgba(16,185,129,.18)`,
                  }}>
                    <Icon style={{ width:14,height:14,color }}/>
                  </div>
                  <span style={{ fontSize:".8rem",color:"rgba(167,243,208,.6)" }}>
                    {text}
                  </span>
                </div>
              ))}
            </div>

            {/* Social proof */}
            <div style={{
              display:"flex",alignItems:"center",gap:".875rem",
              animation:"aLeft .5s ease-out .55s both",
            }}>
              <div style={{ display:"flex" }}>
                {AVATAR_COLORS.map((c,i)=>(
                  <div key={i} style={{
                    width:28,height:28,borderRadius:"50%",
                    background:c,border:"2px solid #041B1A",
                    marginLeft:i>0?-9:0,zIndex:4-i,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:".58rem",color:"#fff",fontWeight:800,
                  }}>
                    {AVATAR_LABELS[i]}
                  </div>
                ))}
              </div>
              <p style={{ fontSize:".75rem",color:"rgba(110,231,183,.55)",lineHeight:1.4 }}>
                <span style={{ color:"#34D399",fontWeight:700 }}>2,400+</span> developers already practising
              </p>
            </div>
          </div>

          {/* Stats row */}
          <div style={{
            display:"flex",gap:"2rem",
            paddingTop:"1.5rem",
            borderTop:"1px solid rgba(16,185,129,.1)",
            animation:"aLeft .5s ease-out .6s both",
          }}>
            {STATS.map(([val,lbl])=>(
              <div key={lbl}>
                <p style={{ fontSize:"1.15rem",fontWeight:800,color:"#fff",letterSpacing:"-.02em" }}>
                  {val}
                </p>
                <p style={{ fontSize:".62rem",color:"rgba(110,231,183,.32)",letterSpacing:".05em",marginTop:1 }}>
                  {lbl}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          RIGHT PANEL — full width on mobile, 50% on desktop
      ═══════════════════════════════════════════════════════════════════ */}
      <div style={{
        flex:1,display:"flex",alignItems:"center",justifyContent:"center",
        padding:"2rem 1.5rem",overflowY:"auto",position:"relative",
        background:"rgba(3,13,12,0.97)",
        animation:"aRight .75s ease-out",
      }}>
        {/* Subtle bg glow */}
        <div style={{
          position:"absolute",inset:0,pointerEvents:"none",
          background:"radial-gradient(ellipse 65% 45% at 50% 25%,rgba(16,185,129,.045) 0%,transparent 70%)",
        }}/>
        {/* Top shimmer */}
        <div style={{
          position:"absolute",top:0,left:0,right:0,height:1,
          background:"linear-gradient(90deg,transparent,rgba(16,185,129,.2),transparent)",
        }}/>

        {/* Mobile logo — hidden on lg */}
        <div className="lg:hidden" style={{
          position:"absolute",top:"1.25rem",left:"1.25rem",
          display:"flex",alignItems:"center",gap:".625rem",
        }}>
          <LogoIcon size={26}/>
          <span style={{ fontWeight:800,fontSize:".875rem" }}>
            <span style={{ color:"#fff" }}>Interview</span>
            <span style={{ color:"#F97316" }}>Ace</span>
          </span>
        </div>

        {/* Form container */}
        <div style={{
          width:"100%",maxWidth:"400px",
          position:"relative",zIndex:10,
          marginTop:"3rem",
        }}
          className="lg:mt-0">
          {children}
        </div>
      </div>
    </div>
  );
}