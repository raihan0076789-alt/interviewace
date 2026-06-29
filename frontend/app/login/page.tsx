"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowRight, AlertCircle } from "lucide-react";
import { authAPI } from "@/lib/api";
import { setTokens } from "@/lib/auth";
import AuthLayout from "@/components/AuthLayout";

// Social button SVGs
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" style={{ width:18,height:18 }}>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" style={{ width:18,height:18 }} fill="currentColor">
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
  </svg>
);

const LinkedInIcon = () => (
  <svg viewBox="0 0 24 24" style={{ width:18,height:18 }}>
    <path fill="#0A66C2" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

// Shared input style factory
const inputStyle = (focused: boolean): React.CSSProperties => ({
  width:"100%",
  background: focused ? "rgba(6,28,25,.95)" : "rgba(4,18,16,.9)",
  border: `1px solid ${focused ? "rgba(16,185,129,.55)" : "rgba(16,185,129,.15)"}`,
  boxShadow: focused ? "0 0 0 3px rgba(16,185,129,.1),0 0 20px rgba(16,185,129,.05)" : "none",
  borderRadius:".7rem",
  padding:".7rem 1rem .7rem 2.85rem",
  color:"#ECFDF5",
  fontSize:".875rem",
  outline:"none",
  transition:"all .2s ease",
});

const socialBtn: React.CSSProperties = {
  flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:".5rem",
  padding:".625rem .75rem",borderRadius:".65rem",cursor:"pointer",
  background:"rgba(4,18,16,.8)",
  border:"1px solid rgba(16,185,129,.14)",
  color:"rgba(167,243,208,.7)",fontSize:".8rem",fontWeight:500,
  transition:"all .2s ease",
};

export default function LoginPage() {
  const router = useRouter();
  const [email,       setEmail      ] = useState("");
  const [password,    setPassword   ] = useState("");
  const [showPass,    setShowPass   ] = useState(false);
  const [emailFocus,  setEmailFocus ] = useState(false);
  const [passFocus,   setPassFocus  ] = useState(false);
  const [error,       setError      ] = useState("");
  const [loading,     setLoading    ] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const data = await authAPI.login(email, password);
      setTokens(data.access_token, data.refresh_token);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally { setLoading(false); }
  };

  return (
    <AuthLayout
      tagline="Ace Every"
      taglineAccent="Interview."
      subtitle="AI-powered mock interviews to analyse, improve and land your dream role."
    >
      {/* Heading */}
      <div style={{ marginBottom:"2rem", animation:"aUp .5s ease-out .05s both" }}>
        <h2 style={{
          fontSize:"1.625rem",fontWeight:800,color:"#fff",letterSpacing:"-.03em",marginBottom:".3rem",
        }}>
          Welcome back
        </h2>
        <p style={{ fontSize:".875rem",color:"rgba(110,231,183,.45)" }}>
          Login to continue your journey
        </p>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          display:"flex",alignItems:"center",gap:".625rem",
          padding:".75rem 1rem",borderRadius:".65rem",marginBottom:"1.25rem",
          background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.25)",
          color:"#F87171",fontSize:".8125rem",
          animation:"aUp .3s ease-out",
        }}>
          <AlertCircle style={{ width:15,height:15,flexShrink:0 }}/>
          {error}
        </div>
      )}

      <form onSubmit={handle} style={{ animation:"aUp .5s ease-out .1s both" }}>

        {/* Email */}
        <div style={{ marginBottom:"1rem" }}>
          <label style={{ fontSize:".78rem",color:"rgba(110,231,183,.6)",display:"block",marginBottom:".4rem",fontWeight:600 }}>
            Email address
          </label>
          <div style={{ position:"relative" }}>
            <Mail style={{
              position:"absolute",left:".875rem",top:"50%",transform:"translateY(-50%)",
              width:15,height:15,color:emailFocus?"#10B981":"rgba(110,231,183,.3)",transition:"color .2s",
            }}/>
            <input
              type="email" autoComplete="email" required value={email}
              onChange={e=>setEmail(e.target.value)}
              onFocus={()=>setEmailFocus(true)} onBlur={()=>setEmailFocus(false)}
              placeholder="you@example.com"
              style={inputStyle(emailFocus)}
            />
          </div>
        </div>

        {/* Password */}
        <div style={{ marginBottom:".75rem" }}>
          <div style={{ display:"flex",justifyContent:"space-between",marginBottom:".4rem" }}>
            <label style={{ fontSize:".78rem",color:"rgba(110,231,183,.6)",fontWeight:600 }}>
              Password
            </label>
            <span style={{ fontSize:".75rem",color:"rgba(16,185,129,.6)",cursor:"pointer" }}>
              Forgot password?
            </span>
          </div>
          <div style={{ position:"relative" }}>
            <Lock style={{
              position:"absolute",left:".875rem",top:"50%",transform:"translateY(-50%)",
              width:15,height:15,color:passFocus?"#10B981":"rgba(110,231,183,.3)",transition:"color .2s",
            }}/>
            <input
              type={showPass?"text":"password"}
              autoComplete="current-password" required value={password}
              onChange={e=>setPassword(e.target.value)}
              onFocus={()=>setPassFocus(true)} onBlur={()=>setPassFocus(false)}
              placeholder="Enter your password"
              style={{ ...inputStyle(passFocus), paddingRight:"2.85rem" }}
            />
            <button type="button" onClick={()=>setShowPass(!showPass)} style={{
              position:"absolute",right:".875rem",top:"50%",transform:"translateY(-50%)",
              background:"none",border:"none",cursor:"pointer",padding:0,
              color:"rgba(110,231,183,.4)",display:"flex",transition:"color .2s",
            }}
              onMouseEnter={e=>(e.currentTarget.style.color="#10B981")}
              onMouseLeave={e=>(e.currentTarget.style.color="rgba(110,231,183,.4)")}>
              {showPass
                ? <EyeOff style={{ width:15,height:15 }}/>
                : <Eye    style={{ width:15,height:15 }}/>}
            </button>
          </div>
        </div>

        {/* Submit */}
        <button type="submit" disabled={loading} style={{
          width:"100%",display:"flex",alignItems:"center",justifyContent:"center",
          gap:".5rem",padding:".8rem 1.5rem",marginTop:"1.25rem",
          borderRadius:".7rem",border:"none",cursor:loading?"not-allowed":"pointer",
          fontWeight:700,fontSize:".9rem",color:"#fff",
          background:loading
            ?"rgba(16,185,129,.4)"
            :"linear-gradient(135deg,#10B981 0%,#0ea674 50%,#14B8A6 100%)",
          boxShadow:loading?"none":"0 4px 20px rgba(16,185,129,.35)",
          transition:"all .2s ease",
          opacity:loading?.75:1,
        }}
          onMouseEnter={e=>{ if(!loading){
            (e.currentTarget as HTMLElement).style.boxShadow="0 6px 28px rgba(16,185,129,.5)";
            (e.currentTarget as HTMLElement).style.transform="translateY(-1px)";
          }}}
          onMouseLeave={e=>{ if(!loading){
            (e.currentTarget as HTMLElement).style.boxShadow="0 4px 20px rgba(16,185,129,.35)";
            (e.currentTarget as HTMLElement).style.transform="translateY(0)";
          }}}>
          {loading
            ? <><Loader2 style={{ width:16,height:16,animation:"spin 1s linear infinite" }}/> Signing in…</>
            : <> Log In <ArrowRight style={{ width:15,height:15 }}/></>}
        </button>
      </form>

      {/* Divider */}
      <div style={{
        display:"flex",alignItems:"center",gap:".75rem",
        margin:"1.5rem 0",
        animation:"aUp .5s ease-out .2s both",
      }}>
        <div style={{ flex:1,height:1,background:"rgba(16,185,129,.1)" }}/>
        <span style={{ fontSize:".75rem",color:"rgba(110,231,183,.3)",whiteSpace:"nowrap" }}>
          or continue with
        </span>
        <div style={{ flex:1,height:1,background:"rgba(16,185,129,.1)" }}/>
      </div>

      {/* Social buttons */}
      <div style={{
        display:"flex",gap:".625rem",
        animation:"aUp .5s ease-out .25s both",
      }}>
        {[
          { icon:<GoogleIcon/>,   label:"Google"   },
          { icon:<GitHubIcon/>,   label:"GitHub"   },
          { icon:<LinkedInIcon/>, label:"LinkedIn"  },
        ].map(({icon,label})=>(
          <button key={label} type="button" style={socialBtn}
            onMouseEnter={e=>{
              (e.currentTarget as HTMLElement).style.borderColor="rgba(16,185,129,.3)";
              (e.currentTarget as HTMLElement).style.background="rgba(16,185,129,.07)";
              (e.currentTarget as HTMLElement).style.color="#A7F3D0";
            }}
            onMouseLeave={e=>{
              (e.currentTarget as HTMLElement).style.borderColor="rgba(16,185,129,.14)";
              (e.currentTarget as HTMLElement).style.background="rgba(4,18,16,.8)";
              (e.currentTarget as HTMLElement).style.color="rgba(167,243,208,.7)";
            }}>
            {icon}
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Register link */}
      <p style={{
        textAlign:"center",marginTop:"1.75rem",
        fontSize:".8125rem",color:"rgba(110,231,183,.4)",
        animation:"aUp .5s ease-out .3s both",
      }}>
        Don&apos;t have an account?{" "}
        <Link href="/register" style={{
          color:"#34D399",fontWeight:700,textDecoration:"none",
          transition:"color .15s",
        }}
          onMouseEnter={e=>(e.currentTarget.style.color="#6EE7B7")}
          onMouseLeave={e=>(e.currentTarget.style.color="#34D399")}>
          Sign up
        </Link>
      </p>
    </AuthLayout>
  );
}