import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingBag,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

export const LandingPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col justify-between">
      {/* Hero Section */}
      <div className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-32">
        {/* Midnight Glowing Gradient Backdrop */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-lime/10 blur-[130px] rounded-full pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-[400px] h-[300px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          {/* Tagline Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-navy-800 border border-navy-700 mb-8 animate-fadeIn">
            <span className="w-2 h-2 rounded-full bg-lime animate-ping" />
            <span className="text-xs font-semibold text-lime tracking-wide uppercase">
              Exclusive for Uniworld 1 & Uniworld 2
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-ivory-50 max-w-4xl mx-auto leading-[1.1]">
            Your midnight cravings,{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-lime via-lime-300 to-emerald-400">
              together.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-lg sm:text-xl text-ivory-300 max-w-2xl mx-auto leading-relaxed">
            Never pay ₹40 delivery on a ₹70 cold brew again. Pool late-night orders with hostel mates from Blinkit, Zepto, and Flipkart Minutes to unlock free delivery.
          </p>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/dashboard"
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl bg-lime text-navy-950 font-extrabold text-base hover:bg-lime-400 shadow-glow-lime transition-all duration-200 hover:scale-[1.02]"
            >
              <ShoppingBag className="w-5 h-5" />
              Explore Live Pools
              <ArrowRight className="w-5 h-5" />
            </Link>

            {!user && (
              <Link
                to="/auth?mode=register"
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-navy-800 hover:bg-navy-750 text-ivory-100 font-bold text-base border border-navy-700 transition-all hover:border-navy-600"
              >
                Join with @sst.scaler.com
              </Link>
            )}
          </div>

          {/* Value Props Strip */}
          <div className="mt-16 pt-10 border-t border-navy-800/80 max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 text-left">
            <div>
              <div className="text-2xl font-extrabold text-lime font-mono">₹0</div>
              <div className="text-xs text-ivory-400 mt-0.5">Shared delivery fee target</div>
            </div>
            <div>
              <div className="text-2xl font-extrabold text-ivory-100 font-mono">100%</div>
              <div className="text-xs text-ivory-400 mt-0.5">Verified SST college students</div>
            </div>
            <div>
              <div className="text-2xl font-extrabold text-ivory-100 font-mono">₹0.01</div>
              <div className="text-xs text-ivory-400 mt-0.5">Exact mathematical fee splitting</div>
            </div>
            <div>
              <div className="text-2xl font-extrabold text-lime font-mono">Live</div>
              <div className="text-xs text-ivory-400 mt-0.5">Real-time collaborative cart</div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Showcase Grid */}
      <div className="py-16 bg-navy-950/40 border-y border-navy-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-xs font-bold text-lime uppercase tracking-widest mb-2">
              Built for Campus Life
            </h2>
            <h3 className="text-3xl font-extrabold text-ivory-50 tracking-tight">
              How NightOwl solves midnight orders
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="p-6 rounded-2xl bg-navy-850 border border-navy-750 relative overflow-hidden group hover:border-navy-700 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-lime/10 text-lime flex items-center justify-center font-bold font-mono text-lg mb-4 border border-lime/20">
                01
              </div>
              <h4 className="text-lg font-bold text-ivory-100 mb-2">
                Discover or Create a Pool
              </h4>
              <p className="text-sm text-ivory-400 leading-relaxed">
                Filter by your hostel (Uniworld 1 or Uniworld 2) and favorite retailer (Blinkit, Zepto, Flipkart Minutes). Set a closing countdown timer.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-2xl bg-navy-850 border border-navy-750 relative overflow-hidden group hover:border-navy-700 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold font-mono text-lg mb-4 border border-sky-500/20">
                02
              </div>
              <h4 className="text-lg font-bold text-ivory-100 mb-2">
                Collaborative Live Cart
              </h4>
              <p className="text-sm text-ivory-400 leading-relaxed">
                Add snacks, noodles, and beverages with your roommates in real time. Watch the progress bar unlock free delivery together.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-2xl bg-navy-850 border border-navy-750 relative overflow-hidden group hover:border-navy-700 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold font-mono text-lg mb-4 border border-purple-500/20">
                03
              </div>
              <h4 className="text-lg font-bold text-ivory-100 mb-2">
                Exact Proportional Split
              </h4>
              <p className="text-sm text-ivory-400 leading-relaxed">
                Shared delivery and handling fees are proportionally distributed down to the last paisa. Pay the host directly via UPI with zero platform fee.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Campus Trust Banner */}
      <div className="py-16 max-w-5xl mx-auto px-4 text-center">
        <div className="p-8 rounded-3xl bg-navy-850 border border-navy-750 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-navy-800 border border-navy-700 flex items-center justify-center p-2 mb-4">
              <img src="/owl-icon.svg" alt="NightOwl" className="w-full h-full" />
            </div>
            <h3 className="text-2xl font-bold text-ivory-50">
              Only Verified Scaler School of Technology Accounts
            </h3>
            <p className="mt-2 text-sm text-ivory-300 max-w-xl">
              We verify all student accounts using one-time verification codes sent to your official <span className="font-mono text-lime">@sst.scaler.com</span> inbox.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <span className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-full bg-navy-800 text-ivory-300 border border-navy-700">
                <CheckCircle className="w-3.5 h-3.5 text-lime" /> Zero Stored Passwords
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-full bg-navy-800 text-ivory-300 border border-navy-700">
                <CheckCircle className="w-3.5 h-3.5 text-lime" /> Single-Use Email OTPs
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-full bg-navy-800 text-ivory-300 border border-navy-700">
                <CheckCircle className="w-3.5 h-3.5 text-lime" /> Secure HttpOnly Session Cookies
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
