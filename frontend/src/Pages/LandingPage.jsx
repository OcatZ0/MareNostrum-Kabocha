import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Truck,
  Ship,
  Leaf,
  Bell,
  Users,
  Radar,
  ArrowRight,
  ArrowUpRight,
  MapPin,
  ShieldCheck,
  Navigation,
  Compass,
  CheckCircle2,
  Anchor,
  Clock,
  Sparkles,
  Gauge,
  Activity,
  Layers,
} from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import logoImg from "../assets/logo.png";

gsap.registerPlugin(ScrollTrigger);

const c = {
  navy: "#1A365D",
  ink: "#0D2137",
  teal: "#2A6F8A",
  aqua: "#4299E1",
  green: "#38A169",
  bg: "#F7FAFC",
  mist: "#E9F0F6",
  line: "#D7E3EE",
  cardBg: "#FFFFFF",
  accentGlow: "rgba(66, 153, 225, 0.15)",
};

const fontDisplay = "'Fraunces', 'Georgia', serif";
const fontBody = "'Inter', 'Helvetica Neue', sans-serif";
const fontMono = "'JetBrains Mono', 'Courier New', monospace";

function Eyebrow({ children, dark, className = "" }) {
  return (
    <div
      className={`eyebrow-badge ${className}`}
      style={{
        fontFamily: fontMono,
        fontSize: "0.72rem",
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: dark ? "#9FC4E8" : c.teal,
        display: "inline-flex",
        alignItems: "center",
        gap: "0.6em",
        marginBottom: "1rem",
        padding: "0.25rem 0.65rem",
        borderRadius: "999px",
        background: dark ? "rgba(159,196,232,0.12)" : "rgba(42,111,138,0.08)",
        border: `1px solid ${dark ? "rgba(159,196,232,0.2)" : "rgba(42,111,138,0.15)"}`,
      }}
    >
      <span style={{ width: 14, height: 2, background: dark ? "#9FC4E8" : c.teal, display: "inline-block", borderRadius: 1 }} />
      {children}
    </div>
  );
}

function CompassMark({ size = 34 }) {
  return (
    <img
      src={logoImg}
      alt="Mare Nostrum Logo"
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        display: "block",
        filter: "drop-shadow(0 2px 4px rgba(26,54,93,0.15))",
      }}
    />
  );
}

function RouteDiagram() {
  return (
    <div
      className="hero-diagram-card"
      style={{
        position: "relative",
        borderRadius: 22,
        background: `linear-gradient(160deg, #0A192F 0%, ${c.navy} 55%, #1B4965 100%)`,
        padding: "2.4rem 1.8rem",
        overflow: "hidden",
        minHeight: 440,
        boxShadow: "0 24px 48px -12px rgba(13,33,55,0.35), 0 0 0 1px rgba(255,255,255,0.08)",
      }}
    >
      {/* Glow highlight in background */}
      <div
        className="diagram-pulse-glow"
        style={{
          position: "absolute",
          top: "20%",
          right: "10%",
          width: "260px",
          height: "260px",
          background: "radial-gradient(circle, rgba(66,153,225,0.22) 0%, rgba(56,161,105,0.08) 50%, transparent 70%)",
          borderRadius: "50%",
          filter: "blur(28px)",
          pointerEvents: "none",
        }}
      />

      {/* Rotating compass rose in background */}
      <svg
        viewBox="0 0 200 200"
        style={{
          position: "absolute",
          top: -40,
          right: -40,
          width: 300,
          height: 300,
          opacity: 0.16,
          animation: "spin-slow 90s linear infinite",
          pointerEvents: "none",
        }}
      >
        <circle cx="100" cy="100" r="92" stroke="#BEE3F8" strokeWidth="1" fill="none" />
        <circle cx="100" cy="100" r="70" stroke="#BEE3F8" strokeWidth="1" fill="none" strokeDasharray="4 4" />
        {Array.from({ length: 16 }).map((_, i) => {
          const angle = (i * 360) / 16;
          const long = i % 4 === 0;
          return (
            <line
              key={i}
              x1="100"
              y1="8"
              x2="100"
              y2={long ? "22" : "16"}
              stroke="#BEE3F8"
              strokeWidth={long ? 1.6 : 1}
              transform={`rotate(${angle} 100 100)`}
            />
          );
        })}
      </svg>

      <div style={{ position: "relative", zIndex: 2 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1.6rem",
          }}
        >
          <div
            style={{
              fontFamily: fontMono,
              fontSize: "0.68rem",
              letterSpacing: "0.14em",
              color: "#9FC4E8",
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#48BB78",
                boxShadow: "0 0 8px #48BB78",
                display: "inline-block",
              }}
            />
            Active Cross-Border Lane
          </div>
          <span
            style={{
              fontFamily: fontMono,
              fontSize: "0.62rem",
              color: "#63B3ED",
              background: "rgba(66,153,225,0.15)",
              padding: "0.2rem 0.5rem",
              borderRadius: 4,
            }}
          >
            01.13°N 103.99°E → 01.26°N 103.85°E
          </span>
        </div>

        {/* SVG Route Visualization */}
        <svg viewBox="0 0 340 220" width="100%" height="auto" style={{ display: "block" }}>
          <defs>
            <linearGradient id="lane" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#4299E1" />
              <stop offset="45%" stopColor="#63B3ED" />
              <stop offset="100%" stopColor="#38A169" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Static base road/sea route */}
          <path
            id="lanepath"
            d="M 30 60 C 110 40, 150 130, 240 110 S 300 150, 315 165"
            stroke="#2A4A6B"
            strokeWidth="2.5"
            fill="none"
          />
          {/* Animated dashed lane */}
          <path
            d="M 30 60 C 110 40, 150 130, 240 110 S 300 150, 315 165"
            stroke="url(#lane)"
            strokeWidth="2.8"
            strokeDasharray="6 7"
            fill="none"
            filter="url(#glow)"
            style={{ animation: "dash-flow 3.2s linear infinite" }}
          />

          {/* Origin Node: Batam Warehouse */}
          <rect x="20" y="52" width="18" height="18" rx="4" fill="#F7FAFC" />
          <rect x="24" y="56" width="4" height="9" fill={c.navy} rx="1" />
          <rect x="30" y="56" width="4" height="9" fill={c.navy} rx="1" />
          <text x="12" y="42" fontFamily={fontMono} fontSize="9" fontWeight="600" fill="#CBD9E8">
            BATAM · WAREHOUSE A
          </text>

          {/* Intermediary Port Checkpoint: Batam Port */}
          <circle cx="165" cy="118" r="4" fill="#63B3ED" />
          <text x="140" y="105" fontFamily={fontMono} fontSize="8" fill="#9FC4E8">
            BATAM PORT (RO-RO)
          </text>

          {/* Destination Node: Singapore Port */}
          <circle cx="315" cy="165" r="6" fill="#F7FAFC" />
          <circle cx="315" cy="165" r="10" stroke="#38A169" strokeWidth="1.6" fill="none">
            <animate attributeName="r" values="9.5;18;9.5" dur="2.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.9;0;0.9" dur="2.6s" repeatCount="indefinite" />
          </circle>
          <text x="235" y="195" fontFamily={fontMono} fontSize="9" fontWeight="600" fill="#9AE6B4">
            SINGAPORE PORT (PSA)
          </text>

          {/* Live Moving Marker along the lane */}
          <circle r="5" fill="#FFFFFF" filter="url(#glow)">
            <animateMotion
              dur="3.4s"
              repeatCount="indefinite"
              path="M 30 60 C 110 40, 150 130, 240 110 S 300 150, 315 165"
            />
          </circle>
        </svg>

        {/* Live Telemetry Status Badges */}
        <div
          style={{
            marginTop: "1.6rem",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.75rem",
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.06)",
              backdropFilter: "blur(4px)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10,
              padding: "0.7rem 0.9rem",
            }}
          >
            <div style={{ fontFamily: fontMono, fontSize: "0.66rem", color: "#8FB4D8", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 6 }}>
              <Truck size={13} color="#63B3ED" /> TRUCK TELEMETRY
            </div>
            <div style={{ fontFamily: fontBody, fontSize: "0.86rem", fontWeight: 600, color: "#F7FAFC", marginTop: 3 }}>
              En route to Batam Port (GPS Active)
            </div>
          </div>
          <div
            style={{
              background: "rgba(255,255,255,0.06)",
              backdropFilter: "blur(4px)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10,
              padding: "0.7rem 0.9rem",
            }}
          >
            <div style={{ fontFamily: fontMono, fontSize: "0.66rem", color: "#8FB4D8", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 6 }}>
              <Ship size={13} color="#48BB78" /> VESSEL TRANSIT
            </div>
            <div style={{ fontFamily: fontBody, fontSize: "0.86rem", fontWeight: 600, color: "#F7FAFC", marginTop: 3 }}>
              Vessel #MN-SG902 — ETA 45m
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc, accent }) {
  return (
    <div
      className="feature-card feature-card-anim"
      style={{
        background: "#fff",
        border: `1px solid ${c.line}`,
        borderRadius: 16,
        padding: "1.75rem",
        boxShadow: "0 4px 16px -4px rgba(26,54,93,0.06)",
        transition: "transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.25s ease, border-color 0.25s ease",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        className="card-accent-strip"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, ${accent}, transparent)`,
        }}
      />
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: accent + "18",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "1.2rem",
          border: `1px solid ${accent}30`,
        }}
      >
        <Icon size={22} color={accent} strokeWidth={2} />
      </div>
      <h3 style={{ fontFamily: fontBody, fontWeight: 700, fontSize: "1.08rem", color: c.ink, margin: "0 0 0.5rem", letterSpacing: "-0.01em" }}>
        {title}
      </h3>
      <p style={{ fontFamily: fontBody, fontSize: "0.92rem", color: "#4A5F73", lineHeight: 1.6, margin: 0 }}>
        {desc}
      </p>
    </div>
  );
}

function StepRow({ number, title, desc, last }) {
  return (
    <div
      className="step-item"
      style={{
        display: "flex",
        gap: "1.6rem",
        paddingBottom: last ? 0 : "2.2rem",
        marginBottom: last ? 0 : "2.2rem",
        borderBottom: last ? "none" : `1px dashed ${c.line}`,
        alignItems: "flex-start",
      }}
    >
      <div
        className="step-badge"
        style={{
          fontFamily: fontMono,
          fontSize: "0.9rem",
          fontWeight: 700,
          color: "#fff",
          background: `linear-gradient(135deg, ${c.navy}, ${c.aqua})`,
          width: 42,
          height: 42,
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: "0 4px 12px -2px rgba(66,153,225,0.3)",
        }}
      >
        {number}
      </div>
      <div>
        <h3 style={{ fontFamily: fontDisplay, fontWeight: 600, fontSize: "1.3rem", color: c.ink, margin: "0 0 0.4rem" }}>
          {title}
        </h3>
        <p style={{ fontFamily: fontBody, fontSize: "0.95rem", color: "#4A5F73", lineHeight: 1.7, margin: 0, maxWidth: 540 }}>
          {desc}
        </p>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const pageRef = useRef(null);

  useEffect(() => {
    // GSAP Context for clean component lifecycle
    const ctx = gsap.context(() => {
      // 1. Header entrance
      gsap.from(".anim-header", {
        y: -30,
        opacity: 0,
        duration: 0.85,
        ease: "power3.out",
      });

      // 2. Hero Timeline sequence
      const heroTl = gsap.timeline({ defaults: { ease: "power3.out" } });
      heroTl
        .from(".hero-eyebrow", { opacity: 0, y: 20, duration: 0.6 }, "+=0.1")
        .from(".hero-title", { opacity: 0, y: 35, duration: 0.85 }, "-=0.35")
        .from(".hero-desc", { opacity: 0, y: 25, duration: 0.7 }, "-=0.45")
        .from(".hero-btn", { opacity: 0, y: 20, stagger: 0.12, duration: 0.6 }, "-=0.35")
        .from(".hero-stat-item", { opacity: 0, scale: 0.85, y: 15, stagger: 0.12, duration: 0.65 }, "-=0.25")
        .from(".hero-diagram-card", { opacity: 0, x: 45, scale: 0.96, duration: 0.95, ease: "power2.out" }, "-=0.85");

      // Continuous pulse on background glow in diagram
      gsap.to(".diagram-pulse-glow", {
        scale: 1.2,
        opacity: 0.65,
        repeat: -1,
        yoyo: true,
        duration: 2.5,
        ease: "sine.inOut",
      });

      // 3. Problem Section (ScrollTrigger)
      gsap.from(".problem-left", {
        scrollTrigger: {
          trigger: ".problem-section",
          start: "top 80%",
          toggleActions: "play none none none",
        },
        x: -40,
        opacity: 0,
        duration: 0.85,
        ease: "power2.out",
      });

      gsap.from(".problem-right p", {
        scrollTrigger: {
          trigger: ".problem-section",
          start: "top 80%",
          toggleActions: "play none none none",
        },
        x: 40,
        opacity: 0,
        stagger: 0.18,
        duration: 0.85,
        ease: "power2.out",
      });

      // 4. How It Works (Steps) Section (ScrollTrigger)
      gsap.from(".steps-header", {
        scrollTrigger: {
          trigger: "#alur",
          start: "top 82%",
          toggleActions: "play none none none",
        },
        y: 30,
        opacity: 0,
        duration: 0.7,
        ease: "power2.out",
      });

      gsap.from(".step-item", {
        scrollTrigger: {
          trigger: ".steps-container",
          start: "top 78%",
          toggleActions: "play none none none",
        },
        x: -40,
        opacity: 0,
        stagger: 0.16,
        duration: 0.8,
        ease: "power3.out",
      });

      // 5. Features Grid Section (ScrollTrigger)
      gsap.from(".features-header", {
        scrollTrigger: {
          trigger: "#fitur",
          start: "top 82%",
          toggleActions: "play none none none",
        },
        y: 30,
        opacity: 0,
        duration: 0.7,
        ease: "power2.out",
      });

      gsap.from(".feature-card-anim", {
        scrollTrigger: {
          trigger: ".features-grid",
          start: "top 78%",
          toggleActions: "play none none none",
        },
        y: 45,
        opacity: 0,
        scale: 0.94,
        stagger: 0.1,
        duration: 0.75,
        ease: "back.out(1.2)",
      });

      // 6. Roles Section (ScrollTrigger)
      gsap.from(".roles-header", {
        scrollTrigger: {
          trigger: "#peran",
          start: "top 82%",
          toggleActions: "play none none none",
        },
        y: 30,
        opacity: 0,
        duration: 0.7,
        ease: "power2.out",
      });

      gsap.from(".role-card-admin", {
        scrollTrigger: {
          trigger: ".roles-grid",
          start: "top 75%",
          toggleActions: "play none none none",
        },
        x: -50,
        opacity: 0,
        duration: 0.9,
        ease: "power3.out",
      });

      gsap.from(".role-card-driver", {
        scrollTrigger: {
          trigger: ".roles-grid",
          start: "top 75%",
          toggleActions: "play none none none",
        },
        x: 50,
        opacity: 0,
        duration: 0.9,
        ease: "power3.out",
      });

      gsap.from(".role-list-item", {
        scrollTrigger: {
          trigger: ".roles-grid",
          start: "top 70%",
          toggleActions: "play none none none",
        },
        x: -15,
        opacity: 0,
        stagger: 0.08,
        duration: 0.5,
        ease: "power2.out",
      });

      // 7. CTA Banner (ScrollTrigger)
      gsap.from(".cta-banner-anim", {
        scrollTrigger: {
          trigger: "#kontak",
          start: "top 85%",
          toggleActions: "play none none none",
        },
        scale: 0.92,
        y: 35,
        opacity: 0,
        duration: 0.85,
        ease: "power3.out",
      });

      // 8. Footer Reveal
      gsap.from(".footer-anim", {
        scrollTrigger: {
          trigger: "footer",
          start: "top 92%",
          toggleActions: "play none none none",
        },
        y: 20,
        opacity: 0,
        duration: 0.6,
        ease: "power2.out",
      });
    }, pageRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={pageRef}
      style={{
        minHeight: "100vh",
        fontFamily: fontBody,
        color: c.ink,
        backgroundColor: c.bg,
        backgroundImage: `
          radial-gradient(ellipse 900px 500px at 85% -5%, rgba(66,153,225,0.12), transparent 60%),
          radial-gradient(ellipse 700px 500px at -10% 30%, rgba(56,161,105,0.09), transparent 55%),
          linear-gradient(rgba(26,54,93,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(26,54,93,0.04) 1px, transparent 1px)
        `,
        backgroundSize: "auto, auto, 42px 42px, 42px 42px",
        backgroundPosition: "0 0, 0 0, -1px -1px, -1px -1px",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }

        @keyframes dash-flow {
          to { stroke-dashoffset: -26; }
        }
        @keyframes spin-slow {
          to { transform: rotate(360deg); }
        }
        @keyframes float-gentle {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }

        .feature-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 16px 32px -12px rgba(26,54,93,0.16);
          border-color: #BEE3F8 !important;
        }

        .cta-btn {
          transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.2s ease, filter 0.2s ease;
        }
        .cta-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 24px -6px rgba(66,153,225,0.45);
          filter: brightness(1.05);
        }

        .nav-link { position: relative; }
        .nav-link:after {
          content: ""; position: absolute; left: 0; bottom: -4px; width: 0; height: 2px;
          background: ${c.aqua}; transition: width 0.25s ease; border-radius: 2px;
        }
        .nav-link:hover:after { width: 100%; }

        @media (max-width: 900px) {
          .hero-grid { grid-template-columns: 1fr !important; gap: 2.5rem !important; }
          .steps-grid { grid-template-columns: 1fr !important; }
          .roles-grid { grid-template-columns: 1fr !important; }
          .nav-links { display: none !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>

      {/* HEADER */}
      <header
        className="anim-header"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "rgba(247,250,252,0.88)",
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${c.line}`,
        }}
      >
        <div
          style={{
            maxWidth: 1160,
            margin: "0 auto",
            padding: "0.9rem 1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <CompassMark size={32} />
            <div>
              <div style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: "1.1rem", lineHeight: 1.1, color: c.ink }}>
                Mare Nostrum
              </div>
              <div style={{ fontFamily: fontMono, fontSize: "0.62rem", color: c.teal, letterSpacing: "0.1em" }}>
                OUR SEA, OUR TRADE
              </div>
            </div>
          </div>

          <nav className="nav-links" style={{ display: "flex", gap: "2.2rem", fontSize: "0.92rem", fontWeight: 500 }}>
            <a href="#fitur" className="nav-link" style={{ color: c.ink, textDecoration: "none" }}>
              Features
            </a>
            <a href="#alur" className="nav-link" style={{ color: c.ink, textDecoration: "none" }}>
              How it works
            </a>
            <a href="#peran" className="nav-link" style={{ color: c.ink, textDecoration: "none" }}>
              Roles
            </a>
          </nav>

          <Link
            to="/app/dashboard"
            className="cta-btn"
            style={{
              background: `linear-gradient(135deg, ${c.navy}, #234E70)`,
              color: "#fff",
              fontSize: "0.88rem",
              fontWeight: 600,
              padding: "0.6rem 1.25rem",
              borderRadius: 10,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              boxShadow: "0 4px 12px -2px rgba(26,54,93,0.25)",
            }}
          >
            Open Dashboard <ArrowUpRight size={15} />
          </Link>
        </div>
      </header>

      {/* HERO SECTION */}
      <section style={{ maxWidth: 1160, margin: "0 auto", padding: "4.5rem 1.5rem 3.5rem" }}>
        <div
          className="hero-grid"
          style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: "3.5rem", alignItems: "center" }}
        >
          <div>
            <Eyebrow className="hero-eyebrow">Smart Mobility Flow · Batam ⇄ Singapore</Eyebrow>
            <h1
              className="hero-title"
              style={{
                fontFamily: fontDisplay,
                fontWeight: 600,
                fontSize: "clamp(2.2rem, 4.2vw, 3.2rem)",
                lineHeight: 1.14,
                margin: "0 0 1.4rem",
                letterSpacing: "-0.015em",
                color: c.ink,
              }}
            >
              One line of sight, from a warehouse in Batam to a berth in Singapore.
            </h1>
            <p
              className="hero-desc"
              style={{ fontSize: "1.08rem", lineHeight: 1.75, color: "#3D5468", maxWidth: 500, margin: "0 0 2.2rem" }}
            >
              Mare Nostrum builds departure schedules from real-time traffic data, then
              follows the truck and the ship until the cargo actually arrives —
              not just until it reaches the port gate.
            </p>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <a
                href="#alur"
                className="cta-btn hero-btn"
                style={{
                  background: `linear-gradient(135deg, ${c.aqua}, #3182CE)`,
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: "0.96rem",
                  padding: "0.9rem 1.6rem",
                  borderRadius: 10,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  boxShadow: "0 8px 20px -6px rgba(66,153,225,0.4)",
                }}
              >
                See the shipment flow <ArrowRight size={16} />
              </a>
              <a
                href="#fitur"
                className="cta-btn hero-btn"
                style={{
                  color: c.navy,
                  fontWeight: 600,
                  fontSize: "0.96rem",
                  padding: "0.9rem 1.3rem",
                  borderRadius: 10,
                  textDecoration: "none",
                  border: `1px solid ${c.line}`,
                  background: "#fff",
                }}
              >
                Explore features
              </a>
            </div>

            {/* Hero Key Metrics */}
            <div
              style={{
                display: "flex",
                gap: "2.4rem",
                marginTop: "3.2rem",
                flexWrap: "wrap",
                paddingTop: "2.2rem",
                borderTop: `1px solid ${c.line}`,
              }}
            >
              {[
                ["3", "departure time options generated automatically"],
                ["±100 m", "arrival validation radius with GPS geofencing"],
                ["2 countries", "one unified tracking line across land & sea"],
              ].map(([n, l]) => (
                <div key={l} className="hero-stat-item">
                  <div style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: "1.6rem", color: c.navy, lineHeight: 1 }}>
                    {n}
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "#5B7185", maxWidth: 140, lineHeight: 1.45, marginTop: 4 }}>
                    {l}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <RouteDiagram />
          </div>
        </div>
      </section>

      {/* PROBLEM SECTION */}
      <section className="problem-section" style={{ background: "#fff", borderTop: `1px solid ${c.line}`, borderBottom: `1px solid ${c.line}` }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "4.5rem 1.5rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: "3.5rem" }} className="hero-grid">
            <div className="problem-left">
              <Eyebrow>The problem</Eyebrow>
              <h2 style={{ fontFamily: fontDisplay, fontWeight: 600, fontSize: "2.1rem", lineHeight: 1.22, margin: 0, color: c.ink }}>
                Congestion comes from three directions at once.
              </h2>
            </div>
            <div className="problem-right" style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}>
              <p style={{ fontSize: "1.04rem", lineHeight: 1.8, color: "#3D5468", margin: 0 }}>
                Sudirman and Yos Sudarso jam up during peak hours. Ferry and port traffic
                to Singapore adds pressure at the same times. In between, logistics
                visibility between Batam's industrial area and Singapore's port is
                close to none — admins end up scheduling on guesswork, not data.
              </p>
              <p style={{ fontSize: "1.04rem", lineHeight: 1.8, color: "#3D5468", margin: 0 }}>
                Mare Nostrum is used by Company A to plan, schedule, and track shipments
                to many partners — across the city and across the border —
                from a single integrated dashboard.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS / ALUR */}
      <section id="alur" style={{ maxWidth: 1160, margin: "0 auto", padding: "5rem 1.5rem" }}>
        <div className="steps-header">
          <Eyebrow>How it works</Eyebrow>
          <h2 style={{ fontFamily: fontDisplay, fontWeight: 600, fontSize: "2.2rem", margin: "0 0 2.8rem", color: c.ink }}>
            Four steps, from plan to delivery.
          </h2>
        </div>
        <div className="steps-container">
          <StepRow
            number="01"
            title="Plan & Traffic Routing"
            desc="Admin picks the origin and destination. The system pulls real-time TomTom traffic data to estimate travel time on the main route."
          />
          <StepRow
            number="02"
            title="Schedule & Slot Recommendation"
            desc="The system builds three departure time options based on congestion and delay history, then admin assigns a truck, driver, and Ship ID for cross-border trips."
          />
          <StepRow
            number="03"
            title="Track on Land with Smart Geofence"
            desc="The driver activates GPS on departure. Once the position enters a 100-meter radius of the destination, arrival confirmation is validated automatically."
          />
          <StepRow
            number="04"
            title="Track at Sea & Final Milestone"
            desc="For cross-border shipments, the ship's status is tracked via its Ship ID until an arrival event is logged at the destination port."
            last
          />
        </div>
      </section>

      {/* FEATURES / WHAT IT DOES */}
      <section id="fitur" style={{ background: c.mist, borderTop: `1px solid ${c.line}`, borderBottom: `1px solid ${c.line}` }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "5rem 1.5rem" }}>
          <div className="features-header">
            <Eyebrow>What it does</Eyebrow>
            <h2 style={{ fontFamily: fontDisplay, fontWeight: 600, fontSize: "2.2rem", margin: "0 0 2.8rem", color: c.ink }}>
              Every part of the journey, in one system.
            </h2>
          </div>
          <div
            className="features-grid steps-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "1.4rem",
            }}
          >
            <FeatureCard
              icon={Radar}
              accent={c.aqua}
              title="Traffic prediction dashboard"
              desc="Main route and departure time recommendations are built from current and historical traffic data."
            />
            <FeatureCard
              icon={Leaf}
              accent={c.green}
              title="CO2 emissions calculator"
              desc="Emissions are estimated per truck and per trip, so the fleet has data to analyze, not just routes to run."
            />
            <FeatureCard
              icon={Bell}
              accent={c.teal}
              title="In-app notifications"
              desc="Drivers and admins are notified the moment a trip is assigned, a checkpoint is hit, or a trip drifts from its estimate."
            />
            <FeatureCard
              icon={Truck}
              accent={c.navy}
              title="Truck & user management"
              desc="Truck, driver, and admin data live in one place, complete with each vehicle's trip history."
            />
            <FeatureCard
              icon={MapPin}
              accent={c.aqua}
              title="Driver GPS tracking"
              desc="Truck position is tracked throughout the trip, with automatic distance validation as it nears the destination."
            />
            <FeatureCard
              icon={Ship}
              accent={c.teal}
              title="Ship tracking via Ship ID"
              desc="For cross-border trips, the ship's status is tracked until an arrival event at the destination port is detected."
            />
          </div>
        </div>
      </section>

      {/* ROLES SECTION */}
      <section id="peran" style={{ maxWidth: 1160, margin: "0 auto", padding: "5rem 1.5rem" }}>
        <div className="roles-header">
          <Eyebrow>Two roles, one flow</Eyebrow>
          <h2 style={{ fontFamily: fontDisplay, fontWeight: 600, fontSize: "2.2rem", margin: "0 0 2.8rem", color: c.ink }}>
            Built for the people who plan and the people who drive.
          </h2>
        </div>
        <div className="roles-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.8rem" }}>
          {/* Admin Role Card */}
          <div
            className="role-card-admin"
            style={{
              background: `linear-gradient(145deg, ${c.ink}, ${c.navy})`,
              color: "#fff",
              borderRadius: 20,
              padding: "2.4rem",
              boxShadow: "0 18px 36px -10px rgba(13,33,55,0.35)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.4rem" }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "rgba(159,196,232,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ShieldCheck size={20} color="#9FC4E8" />
              </div>
              <span style={{ fontFamily: fontMono, fontSize: "0.76rem", fontWeight: 600, letterSpacing: "0.12em", color: "#9FC4E8" }}>
                ADMIN ROLE
              </span>
            </div>
            <h3 style={{ fontFamily: fontDisplay, fontSize: "1.45rem", fontWeight: 600, margin: "0 0 1.2rem", lineHeight: 1.3 }}>
              Plan, schedule, and oversee the whole fleet.
            </h3>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              {[
                "Manage users, trucks, and partner company data",
                "Create and assign shipment schedules with time slots",
                "Choose routes & departure times from system recommendations",
                "Enter Ship ID for cross-border trips to Singapore",
                "Monitor real-time dashboard and trip history analytics",
              ].map((t) => (
                <li key={t} className="role-list-item" style={{ display: "flex", gap: 10, fontSize: "0.94rem", color: "#CBD9E8", lineHeight: 1.55 }}>
                  <CheckCircle2 size={16} color={c.aqua} style={{ flexShrink: 0, marginTop: 3 }} /> {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Driver Role Card */}
          <div
            className="role-card-driver"
            style={{
              background: "#fff",
              border: `1px solid ${c.line}`,
              borderRadius: 20,
              padding: "2.4rem",
              boxShadow: "0 18px 36px -10px rgba(26,54,93,0.08)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.4rem" }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "rgba(42,111,138,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Users size={20} color={c.teal} />
              </div>
              <span style={{ fontFamily: fontMono, fontSize: "0.76rem", fontWeight: 600, letterSpacing: "0.12em", color: c.teal }}>
                DRIVER ROLE
              </span>
            </div>
            <h3 style={{ fontFamily: fontDisplay, fontSize: "1.45rem", fontWeight: 600, margin: "0 0 1.2rem", color: c.ink, lineHeight: 1.3 }}>
              Run assigned trips, right from the browser.
            </h3>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              {[
                "View assigned schedule & destination instructions",
                "Start trip and stream real-time GPS location",
                "Confirm arrival, validated automatically via 100m geofence",
                "Receive instant in-app alerts on schedule changes",
              ].map((t) => (
                <li key={t} className="role-list-item" style={{ display: "flex", gap: 10, fontSize: "0.94rem", color: "#4A5F73", lineHeight: 1.55 }}>
                  <CheckCircle2 size={16} color={c.teal} style={{ flexShrink: 0, marginTop: 3 }} /> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section id="kontak" style={{ maxWidth: 1160, margin: "0 auto", padding: "0 1.5rem 5rem" }}>
        <div
          className="cta-banner-anim"
          style={{
            background: `linear-gradient(120deg, ${c.navy} 0%, #17385F 50%, ${c.teal} 100%)`,
            borderRadius: 22,
            padding: "3.2rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "2rem",
            boxShadow: "0 20px 40px -10px rgba(26,54,93,0.35)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <div>
            <h3 style={{ fontFamily: fontDisplay, color: "#fff", fontSize: "1.65rem", fontWeight: 600, margin: "0 0 0.6rem" }}>
              Closing the gap between the schedule and the road.
            </h3>
            <p style={{ color: "#CBD9E8", margin: 0, fontSize: "1.02rem", maxWidth: 560 }}>
              Smart cross-border logistics visibility platform connecting Batam and Singapore.
            </p>
          </div>
          <Link
            to="/app/dashboard"
            className="cta-btn"
            style={{
              background: `linear-gradient(135deg, ${c.green}, #2F855A)`,
              color: "#fff",
              fontWeight: 600,
              fontSize: "1rem",
              padding: "0.95rem 1.8rem",
              borderRadius: 11,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              whiteSpace: "nowrap",
              boxShadow: "0 8px 20px -4px rgba(56,161,105,0.45)",
            }}
          >
            Launch Platform <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer-anim" style={{ borderTop: `1px solid ${c.line}`, background: "#fff" }}>
        <div
          style={{
            maxWidth: 1160,
            margin: "0 auto",
            padding: "2.4rem 1.5rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1.2rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <CompassMark size={24} />
            <span style={{ fontFamily: fontMono, fontSize: "0.8rem", color: "#5B7185", fontWeight: 500 }}>
              Mare Nostrum — Our sea, our trade
            </span>
          </div>
          <span style={{ fontFamily: fontMono, fontSize: "0.76rem", color: "#8FA3B5" }}>
            Politeknik Negeri Batam Hackathon · Team Kabocha
          </span>
        </div>
      </footer>
    </div>
  );
}