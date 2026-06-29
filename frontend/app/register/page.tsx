"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Mail, Lock, Eye, EyeOff, User, Loader2,
  ArrowRight, AlertCircle, CheckCircle2,
} from "lucide-react";
import { authAPI } from "@/lib/api";
import { setTokens } from "@/lib/auth";
import AuthLayout from "@/components/AuthLayout";

const ROLES = [
  "SDE-1 Backend","SDE-1 Frontend","Full Stack Developer",
  "Data Analyst","DevOps Engineer","Python Developer",
  "AI/ML Engineer","Other",
];

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

const inputStyle = (focused: boolean): React.CSSProperties => ({
  width:"100%",
  background: focused ? "rgba(6,28,25,.95)" : "rgba(4,18,16,.9)",
  border:`1px solid ${focused ? "rgba(16,185,129,.55)" : "rgba(16,185,129,.15)"}`,
  boxShadow: focused ? "0 0 0 3px rgba(16,185,129,.1),0 0 20px rgba(16,185,129,.05)" : "none",
  borderRadius:".7rem",
  padding:".7rem 1rem .7rem 2.85rem",
  color:"#ECFDF5",fontSize:".875rem",outline:"none",
  transition:"all .2s ease",
});

// Password strength meter
function PasswordStrength({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const colors = ["","#EF4444","#F59E0B","#10B981","#34D399"];
  const labels = ["","Weak","Fair","Good","Strong"];
  if (!password) return null;
  return (
    <div style={{ marginTop:".5rem" }}>
      <div style={{ display:"flex",gap:3,marginBottom:"0.3rem" }}>
        {[1,2,3,4].map(i=>(
          <div key={i} style={{
            flex:1,height:3,borderRadius:2,
            background: i<=score ? colors[score] : "rgba(16,185,129,.12)",
            transition:"background .3s",
          }}/>
        ))}
      </div>
      <p style={{ fontSize:".68rem",color:colors[score] }}>{labels[score]}</p>
    </div>
  );
}

const socialBtn: React.CSSProperties = {
  flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:".5rem",
  padding:".625rem .75rem",borderRadius:".65rem",cursor:"pointer",
  background:"rgba(4,18,16,.8)",border:"1px solid rgba(16,185,129,.14)",
  color:"rgba(167,243,208,.7)",fontSize:".8rem",fontWeight:500,
  transition:"all .2s ease",
};

export default function RegisterPage() {
  const router = useRouter();
  const [email,      setEmail     ] = useState("");
  const [password,   setPassword  ] = useState("");
  const [role,       setRole      ] = useState(ROLES[0]);
  const [showPass,   setShowPass  ] = useState(false);
  const [emailFocus, setEmailFocus] = useState(false);
  const [passFocus,  setPassFocus ] = useState(false);
  const [roleFocus,  setRoleFocus ] = useState(false);
  const [error,      setError     ] = useState("");
  const [loading,    setLoading   ] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await authAPI.register(email, password, role);
      const tokens = await authAPI.login(email, password);
      setTokens(tokens.access_token, tokens.refresh_token);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally { setLoading(false); }
  };

  return (
    <AuthLayout
      tagline="Start Your"
      taglineAccent="Journey."
      subtitle="Join thousands of developers who practise smarter and land their dream roles faster."
    >
      {/* Heading */}
      <div style={{ marginBottom:"1.75rem",animation:"aUp .5s ease-out .05s both" }}>
        <h2 style={{
          fontSize:"1.625rem",fontWeight:800,color:"#fff",
          letterSpacing:"-.03em",marginBottom:".3rem",
        }}>
          Create account
        </h2>
        <p style={{ fontSize:".875rem",color:"rgba(110,231,183,.45)" }}>
          Free forever · No credit card required
        </p>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          display:"flex",alignItems:"center",gap:".625rem",
          padding:".75rem 1rem",borderRadius:".65rem",marginBottom:"1.25rem",
          background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.25)",
          color:"#F87171",fontSize:".8125rem",animation:"aUp .3s ease-out",
        }}>
          <AlertCircle style={{ width:15,height:15,flexShrink:0 }}/> {error}
        </div>
      )}

      <form onSubmit={handle} style={{ animation:"aUp .5s ease-out .1s both" }}>

        {/* Email */}
        <div style={{ marginBottom:".875rem" }}>
          <label style={{ fontSize:".78rem",color:"rgba(110,231,183,.6)",display:"block",marginBottom:".4rem",fontWeight:600 }}>
            Email address
          </label>
          <div style={{ position:"relative" }}>
            <Mail style={{
              position:"absolute",left:".875rem",top:"50%",transform:"translateY(-50%)",
              width:15,height:15,color:emailFocus?"#10B981":"rgba(110,231,183,.3)",transition:"color .2s",
            }}/>
            <input type="email" autoComplete="email" required value={email}
              onChange={e=>setEmail(e.target.value)}
              onFocus={()=>setEmailFocus(true)} onBlur={()=>setEmailFocus(false)}
              placeholder="you@example.com" style={inputStyle(emailFocus)}/>
          </div>
        </div>

        {/* Password */}
        <div style={{ marginBottom:".875rem" }}>
          <label style={{ fontSize:".78rem",color:"rgba(110,231,183,.6)",display:"block",marginBottom:".4rem",fontWeight:600 }}>
            Password <span style={{ fontWeight:400,color:"rgba(110,231,183,.3)" }}>(min. 8 chars)</span>
          </label>
          <div style={{ position:"relative" }}>
            <Lock style={{
              position:"absolute",left:".875rem",top:"50%",transform:"translateY(-50%)",
              width:15,height:15,color:passFocus?"#10B981":"rgba(110,231,183,.3)",transition:"color .2s",
            }}/>
            <input type={showPass?"text":"password"} autoComplete="new-password"
              required minLength={8} value={password}
              onChange={e=>setPassword(e.target.value)}
              onFocus={()=>setPassFocus(true)} onBlur={()=>setPassFocus(false)}
              placeholder="Create a strong password"
              style={{ ...inputStyle(passFocus),paddingRight:"2.85rem" }}/>
            <button type="button" onClick={()=>setShowPass(!showPass)} style={{
              position:"absolute",right:".875rem",top:"50%",transform:"translateY(-50%)",
              background:"none",border:"none",cursor:"pointer",padding:0,
              color:"rgba(110,231,183,.4)",display:"flex",transition:"color .2s",
            }}
              onMouseEnter={e=>(e.currentTarget.style.color="#10B981")}
              onMouseLeave={e=>(e.currentTarget.style.color="rgba(110,231,183,.4)")}>
              {showPass ? <EyeOff style={{ width:15,height:15 }}/> : <Eye style={{ width:15,height:15 }}/>}
            </button>
          </div>
          <PasswordStrength password={password}/>
        </div>

        {/* Target role */}
        <div style={{ marginBottom:"1.25rem" }}>
          <label style={{ fontSize:".78rem",color:"rgba(110,231,183,.6)",display:"block",marginBottom:".4rem",fontWeight:600 }}>
            Target role
          </label>
          <div style={{ position:"relative" }}>
            <User style={{
              position:"absolute",left:".875rem",top:"50%",transform:"translateY(-50%)",
              width:15,height:15,color:roleFocus?"#10B981":"rgba(110,231,183,.3)",
              transition:"color .2s",pointerEvents:"none",
            }}/>
            <select value={role} onChange={e=>setRole(e.target.value)}
              onFocus={()=>setRoleFocus(true)} onBlur={()=>setRoleFocus(false)}
              style={{ ...inputStyle(roleFocus),appearance:"none",paddingRight:"2rem",cursor:"pointer" }}>
              {ROLES.map(r=><option key={r} value={r}>{r}</option>)}
            </select>
            {/* Chevron */}
            <svg style={{
              position:"absolute",right:".875rem",top:"50%",transform:"translateY(-50%)",
              width:14,height:14,color:"rgba(110,231,183,.35)",pointerEvents:"none",
            }} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
            </svg>
          </div>
        </div>

        {/* Benefit chips */}
        <div style={{ display:"flex",flexWrap:"wrap",gap:".4rem",marginBottom:"1.25rem" }}>
          {["Free forever","No credit card","AI-powered","Cancel anytime"].map(b=>(
            <div key={b} style={{
              display:"flex",alignItems:"center",gap:".3rem",
              padding:".25rem .6rem",borderRadius:"999px",
              background:"rgba(16,185,129,.07)",border:"1px solid rgba(16,185,129,.15)",
              fontSize:".68rem",color:"rgba(110,231,183,.6)",
            }}>
              <CheckCircle2 style={{ width:10,height:10,color:"#10B981" }}/> {b}
            </div>
          ))}
        </div>

        {/* Submit */}
        <button type="submit" disabled={loading} style={{
          width:"100%",display:"flex",alignItems:"center",justifyContent:"center",
          gap:".5rem",padding:".8rem 1.5rem",
          borderRadius:".7rem",border:"none",cursor:loading?"not-allowed":"pointer",
          fontWeight:700,fontSize:".9rem",color:"#fff",
          background:loading
            ?"rgba(16,185,129,.4)"
            :"linear-gradient(135deg,#10B981 0%,#0ea674 50%,#14B8A6 100%)",
          boxShadow:loading?"none":"0 4px 20px rgba(16,185,129,.35)",
          transition:"all .2s ease",opacity:loading?.75:1,
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
            ? <><Loader2 style={{ width:16,height:16,animation:"spin 1s linear infinite" }}/> Creating account…</>
            : <>Create Account <ArrowRight style={{ width:15,height:15 }}/></>}
        </button>
      </form>

      {/* Divider */}
      <div style={{
        display:"flex",alignItems:"center",gap:".75rem",margin:"1.4rem 0",
        animation:"aUp .5s ease-out .2s both",
      }}>
        <div style={{ flex:1,height:1,background:"rgba(16,185,129,.1)" }}/>
        <span style={{ fontSize:".75rem",color:"rgba(110,231,183,.3)",whiteSpace:"nowrap" }}>
          or continue with
        </span>
        <div style={{ flex:1,height:1,background:"rgba(16,185,129,.1)" }}/>
      </div>

      {/* Social */}
      <div style={{ display:"flex",gap:".625rem",animation:"aUp .5s ease-out .25s both" }}>
        {[
          { icon:<GoogleIcon/>,  label:"Google"  },
          { icon:<GitHubIcon/>,  label:"GitHub"  },
        ].map(({icon,label})=>(
          <button key={label} type="button" style={{ ...socialBtn,flex:"none",
            width:"50%",justifyContent:"center" }}
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
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Login link */}
      <p style={{
        textAlign:"center",marginTop:"1.6rem",
        fontSize:".8125rem",color:"rgba(110,231,183,.4)",
        animation:"aUp .5s ease-out .3s both",
      }}>
        Already have an account?{" "}
        <Link href="/login" style={{ color:"#34D399",fontWeight:700,textDecoration:"none" }}
          onMouseEnter={e=>(e.currentTarget.style.color="#6EE7B7")}
          onMouseLeave={e=>(e.currentTarget.style.color="#34D399")}>
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}