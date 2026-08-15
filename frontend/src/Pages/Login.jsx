import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Ship, Anchor, ArrowLeft, ArrowRight, ShieldCheck, Compass, AlertCircle } from 'lucide-react';
import gsap from 'gsap';
import logo from '../Assets/logo.png';
import axiosClient from '../axios';
import { useStateContext } from '../Contexts/Context';

const COLORS = {
  navy: '#1A365D',
  teal: '#2A6F8A',
  aqua: '#4299E1',
  green: '#38A169',
  bg: '#F7FAFC',
};

const Login = () => {
  const containerRef = useRef(null);
  const navigate = useNavigate();
  const { setToken, setCurrentUser } = useStateContext();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // 1. Entrance animation timeline
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.from('.login-left-panel', {
        x: -80,
        opacity: 0,
        duration: 0.95,
      })
        .from(
          '.login-compass-ring',
          {
            scale: 0.6,
            opacity: 0,
            rotation: -45,
            duration: 1.2,
            ease: 'back.out(1.2)',
          },
          '-=0.7'
        )
        .from(
          '.login-left-brand',
          {
            y: -25,
            opacity: 0,
            duration: 0.7,
          },
          '-=0.8'
        )
        .from(
          '.login-left-text',
          {
            y: 30,
            opacity: 0,
            stagger: 0.12,
            duration: 0.75,
          },
          '-=0.6'
        )
        .from(
          '.login-route-bar',
          {
            scaleX: 0,
            opacity: 0,
            transformOrigin: 'left center',
            duration: 0.8,
          },
          '-=0.5'
        )
        .from(
          '.login-right-panel',
          {
            x: 60,
            opacity: 0,
            duration: 0.9,
          },
          '-=0.85'
        )
        .from(
          '.login-back-btn',
          {
            x: -20,
            opacity: 0,
            duration: 0.6,
          },
          '-=0.6'
        )
        .from(
          '.login-form-item',
          {
            y: 24,
            opacity: 0,
            stagger: 0.08,
            duration: 0.6,
            ease: 'power2.out',
          },
          '-=0.5'
        );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setLoginError(null);

    try {
      const res = await axiosClient.post('/api/login', { username, password });
      const { token, user } = res.data.data;

      setToken(token);
      setCurrentUser(user);
      localStorage.setItem('user_name', user.name);

      navigate(user.role === 'driver' ? '/driver' : '/app', { replace: true });
    } catch (err) {
      setLoginError(err?.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="min-h-screen w-full flex items-stretch font-sans overflow-hidden"
      style={{ backgroundColor: COLORS.bg }}
    >
      <style>{`
        @keyframes marenostrum-sail {
          0%   { left: 6%; }
          50%  { left: 90%; }
          100% { left: 6%; }
        }
        .mn-ship {
          animation: marenostrum-sail 9s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .mn-ship { animation: none; left: 48%; }
        }
      `}</style>

      {/* ===== Left brand panel — hidden on mobile ===== */}
      <div
        className="login-left-panel hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between px-14 py-12"
        style={{
          background: `linear-gradient(160deg, ${COLORS.navy} 0%, #123049 55%, ${COLORS.teal} 100%)`,
        }}
      >
        {/* decorative compass ring */}
        <svg
          className="login-compass-ring absolute -right-24 -top-24 opacity-[0.09] pointer-events-none"
          width="480"
          height="480"
          viewBox="0 0 480 480"
          fill="none"
        >
          <circle cx="240" cy="240" r="210" stroke="white" strokeWidth="1.5" />
          <circle cx="240" cy="240" r="160" stroke="white" strokeWidth="1" />
          {Array.from({ length: 24 }).map((_, i) => {
            const angle = (i * 360) / 24;
            return (
              <line
                key={i}
                x1="240"
                y1="30"
                x2="240"
                y2={i % 6 === 0 ? '52' : '42'}
                stroke="white"
                strokeWidth="1.5"
                transform={`rotate(${angle} 240 240)`}
              />
            );
          })}
        </svg>

        {/* logo mark + wordmark */}
        <div className="login-left-brand relative z-10 flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 shadow-lg"
            style={{ backgroundColor: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)' }}
          >
            <img src={logo} alt="Mare Nostrum Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div>
            <p className="text-white font-semibold tracking-[0.25em] text-sm leading-none">
              MARE NOSTRUM
            </p>
            <p
              className="text-xs italic mt-1 leading-none font-mono"
              style={{ color: COLORS.aqua }}
            >
              Our sea, our trade
            </p>
          </div>
        </div>

        {/* headline */}
        <div className="relative z-10 max-w-md">
          <h1 className="login-left-text text-white text-4xl font-semibold leading-tight tracking-tight">
            One line of sight,
            <br />
            from Batam to Singapore.
          </h1>
          <p className="login-left-text mt-4 text-sm leading-relaxed" style={{ color: '#B9D3E0' }}>
            Plan, schedule, and track cross-city and cross-border shipments
            end-to-end - trucks on land, ships at sea.
          </p>
        </div>

        {/* route signature: Batam -> Singapura */}
        <div className="login-route-bar relative z-10">
          <div className="relative h-px w-full" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `repeating-linear-gradient(to right, ${COLORS.aqua} 0 6px, transparent 6px 14px)`,
                height: '1px',
              }}
            />
            <div className="mn-ship absolute -top-2" style={{ transform: 'translateX(-50%)' }}>
              <Ship size={16} color={COLORS.green} fill={COLORS.green} />
            </div>
          </div>
          <div className="flex justify-between mt-3 text-xs" style={{ color: '#B9D3E0' }}>
            <span className="flex items-center gap-1.5 font-mono">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS.aqua }} />
              Batam (Warehouse)
            </span>
            <span className="flex items-center gap-1.5 font-mono">
              Singapore (Berth)
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS.green }} />
            </span>
          </div>
        </div>
      </div>

      {/* ===== Right form panel ===== */}
      <div className="login-right-panel w-full lg:w-1/2 flex items-center justify-center px-6 py-12 sm:px-10 relative">
        <div className="w-full max-w-sm">
          {/* Back to landing page button */}
          <div className="login-back-btn mb-6">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-500 hover:text-slate-800 transition py-1.5 px-3 rounded-full hover:bg-slate-100 border border-slate-200"
            >
              <ArrowLeft size={13} /> Back to Home
            </Link>
          </div>

          {/* compact brand header for mobile */}
          <div className="login-form-item flex lg:hidden items-center gap-2.5 mb-8">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm"
              style={{ backgroundColor: `${COLORS.navy}14` }}
            >
              <img src={logo} alt="Mare Nostrum Logo" style={{ width: '80%', height: '80%', objectFit: 'contain' }} />
            </div>
            <div>
              <p className="font-semibold tracking-[0.2em] text-xs leading-none" style={{ color: COLORS.navy }}>
                MARE NOSTRUM
              </p>
              <p className="text-xs italic mt-1 leading-none font-mono" style={{ color: COLORS.teal }}>
                Our sea, our trade
              </p>
            </div>
          </div>

          <h2 className="login-form-item text-2xl font-semibold tracking-tight" style={{ color: COLORS.navy }}>
            Sign in to your account
          </h2>
          <p className="login-form-item text-sm text-slate-500 mt-1">
            Enter your admin or driver credentials to continue.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            {loginError && (
              <div className="login-form-item flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-red-200 bg-red-50 text-xs text-red-700">
                <AlertCircle size={14} className="shrink-0" />
                {loginError}
              </div>
            )}

            <div className="login-form-item">
              <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-1.5">
                Username / Email
              </label>
              <div className="relative">
                <Mail
                  size={17}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  id="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin or driver@marenostrum.id"
                  className="w-full pl-11 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:ring-2 focus:border-transparent shadow-sm"
                  style={{ '--tw-ring-color': COLORS.aqua }}
                  onFocus={(e) => (e.target.style.boxShadow = `0 0 0 2px ${COLORS.aqua}`)}
                  onBlur={(e) => (e.target.style.boxShadow = 'none')}
                />
              </div>
            </div>

            <div className="login-form-item">
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock
                  size={17}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-11 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 outline-none transition shadow-sm"
                  onFocus={(e) => (e.target.style.boxShadow = `0 0 0 2px ${COLORS.aqua}`)}
                  onBlur={(e) => (e.target.style.boxShadow = 'none')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            

            <div className="login-form-item pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-lg text-white text-sm font-semibold transition disabled:opacity-70 shadow-md hover:brightness-105 active:scale-[0.99] flex items-center justify-center gap-2"
                style={{
                  background: `linear-gradient(135deg, ${COLORS.navy}, ${COLORS.teal})`,
                }}
              >
                {submitting ? 'Authenticating…' : (
                  <>
                    Sign in <ArrowRight size={15} />
                  </>
                )}
              </button>
            </div>
          </form>

          <p className="login-form-item mt-8 text-xs text-slate-400 leading-relaxed">
            System access is restricted to registered personnel (Admin & Driver). Contact your administrator if you do not have login credentials.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
