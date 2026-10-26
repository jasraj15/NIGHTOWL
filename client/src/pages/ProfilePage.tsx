import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { HostelType } from '../types/index.js';
import { ShieldCheck, User, Mail, Phone, Building2, Save, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const ProfilePage: React.FC = () => {
  const { user, updateProfile, logout } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [hostel, setHostel] = useState<HostelType>(user?.hostel || 'Uniworld 1');
  const [roomNumber, setRoomNumber] = useState(user?.roomNumber || '');

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-ivory-300">Please log in to view your profile.</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      await updateProfile({
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        hostel,
        roomNumber: roomNumber.trim(),
      });
      setMessage('Profile settings saved successfully.');
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="bg-navy-850 border border-navy-750 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* User Identity Header */}
        <div className="flex items-center gap-4 pb-6 border-b border-navy-750">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-navy-800 to-navy-900 border border-navy-700 flex items-center justify-center text-2xl font-bold text-lime shadow-inner">
            {user.fullName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-ivory-50">{user.fullName}</h1>
              {user.isEmailVerified && (
                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-lime/10 text-lime text-xs font-semibold border border-lime/30">
                  <ShieldCheck className="w-3.5 h-3.5" /> Verified Student
                </span>
              )}
            </div>
            <p className="text-xs text-ivory-400 font-mono mt-0.5">{user.email}</p>
          </div>
        </div>

        {message && (
          <div className="p-3.5 rounded-xl bg-lime/10 border border-lime/30 text-lime text-xs">
            {message}
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-ivory-300 mb-1">Full Name</label>
            <div className="relative">
              <User className="absolute left-3.5 top-3 w-4 h-4 text-ivory-500" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-navy-900 border border-navy-700 text-ivory-100 text-sm focus:border-lime outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ivory-400 mb-1">
              Verified SST College Email (Locked)
            </label>
            <div className="relative opacity-70">
              <Mail className="absolute left-3.5 top-3 w-4 h-4 text-ivory-500" />
              <input
                type="email"
                disabled
                value={user.email}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-navy-950 border border-navy-800 text-ivory-400 text-sm font-mono cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ivory-300 mb-1">
                Indian Mobile Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-3 w-4 h-4 text-ivory-500" />
                <input
                  type="tel"
                  required
                  pattern="[6-9][0-9]{9}"
                  maxLength={10}
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-navy-900 border border-navy-700 text-ivory-100 text-sm font-mono focus:border-lime outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ivory-300 mb-1">
                Default Campus Hostel
              </label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-3 w-4 h-4 text-ivory-500" />
                <select
                  value={hostel}
                  onChange={(e) => setHostel(e.target.value as HostelType)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-navy-900 border border-navy-700 text-ivory-100 text-sm focus:border-lime outline-none"
                >
                  <option value="Uniworld 1">Uniworld 1</option>
                  <option value="Uniworld 2">Uniworld 2</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ivory-300 mb-1">
              Hostel Room / Wing Number
            </label>
            <input
              type="text"
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
              placeholder="e.g. Tower A - Room 402"
              className="w-full px-3.5 py-2.5 rounded-xl bg-navy-900 border border-navy-700 text-ivory-100 text-sm focus:border-lime outline-none"
            />
          </div>

          <div className="pt-4 flex items-center justify-between border-t border-navy-750">
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300"
            >
              <LogOut className="w-4 h-4" /> Log out of NightOwl
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-lime text-navy-950 font-bold text-sm hover:bg-lime-400 shadow-glow-lime transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
