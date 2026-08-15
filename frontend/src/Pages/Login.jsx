import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Ship, Anchor, AlertCircle } from 'lucide-react';
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
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState(null);
  const navigate = useNavigate();
  const { setToken, setCurrentUser } = useStateContext();

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
      className="min-h-screen w-full flex items-stretch font-sans"
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
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between px-14 py-12"
        style={{
          background: `linear-gradient(160deg, ${COLORS.navy} 0%, #123049 55%, ${COLORS.teal} 100%)`,
        }}
      >
        {/* decorative compass ring */}
        <svg
          className="absolute -right-24 -top-24 opacity-[0.08]"
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
        <div className="relative z-10 flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.25)' }}
          >
            <img src={logo} alt="Mare Nostrum Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div>
            <p className="text-white font-semibold tracking-[0.25em] text-sm leading-none">
              MARE NOSTRUM
            </p>
            <p
              className="text-xs italic mt-1 leading-none"
              style={{ color: COLORS.aqua }}
            >
              Our sea, our trade
            </p>
          </div>
        </div>

        {/* headline */}
        <div className="relative z-10 max-w-md">
          <h1 className="text-white text-4xl font-semibold leading-tight tracking-tight">
            One line of sight,
            <br />
            from Batam to Singapore.
          </h1>
          <p className="mt-4 text-sm leading-relaxed" style={{ color: '#B9D3E0' }}>
            Plan, schedule, and track cross-city and cross-border shipments
            end-to-end — trucks on land, ships at sea.
          </p>
        </div>

        {/* route signature: Batam -> Singapura */}
        <div className="relative z-10">
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
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS.aqua }} />
              Batam
            </span>
            <span className="flex items-center gap-1.5">
              Singapore
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS.green }} />
            </span>
          </div>
        </div>
      </div>

      {/* ===== Right form panel ===== */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          {/* compact brand header for mobile */}
          <div className="flex lg:hidden items-center gap-2.5 mb-10">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${COLORS.navy}14` }}
            >
              <Anchor size={17} color={COLORS.navy} strokeWidth={2} />
            </div>
            <div>
              <p className="font-semibold tracking-[0.2em] text-xs leading-none" style={{ color: COLORS.navy }}>
                MARE NOSTRUM
              </p>
              <p className="text-xs italic mt-1 leading-none" style={{ color: COLORS.teal }}>
                Our sea, our trade
              </p>
            </div>
          </div>

          <h2 className="text-2xl font-semibold" style={{ color: COLORS.navy }}>
            Sign in to your account
          </h2>
          

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {loginError && (
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-red-200 bg-red-50 text-xs text-red-700">
                <AlertCircle size={14} className="shrink-0" />
                {loginError}
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-1.5">
                Username
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
                  placeholder="e.g. driver"
                  className="w-full pl-11 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:ring-2 focus:border-transparent"
                  style={{ '--tw-ring-color': COLORS.aqua }}
                  onFocus={(e) => (e.target.style.boxShadow = `0 0 0 2px ${COLORS.aqua}`)}
                  onBlur={(e) => (e.target.style.boxShadow = 'none')}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                <a
                  href="#"
                  className="text-xs font-medium hover:underline"
                  style={{ color: COLORS.teal }}
                >
                  Forgot password?
                </a>
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
                  className="w-full pl-11 pr-11 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 outline-none transition"
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

            <label className="flex items-center gap-2 text-sm text-slate-600 select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300"
                style={{ accentColor: COLORS.teal }}
              />
              Remember me on this device
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-lg text-white text-sm font-semibold transition disabled:opacity-70"
              style={{
                background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.aqua})`,
              }}
            >
              {submitting ? 'Checking…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-8 text-xs text-slate-400 leading-relaxed">
            System access is restricted to registered Company A personnel.
            Contact your admin if you don't have an account yet.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;