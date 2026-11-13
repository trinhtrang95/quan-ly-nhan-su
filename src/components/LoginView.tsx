import React, { useState } from 'react';
import { Lock, User, LogIn, Eye, EyeOff, Loader2 } from 'lucide-react';
import { CompanyUnit, UserAccount } from '../types/hr';
import { authenticateAppUserInSupabase } from '../utils/supabaseService';

interface LoginViewProps {
  accounts: UserAccount[];
  activeCompany: CompanyUnit;
  isCloudConnected: boolean;
  onLoginSuccess: (account: UserAccount) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  accounts,
  onLoginSuccess,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const performLogin = async (userStr: string, passStr: string) => {
    setErrorMsg('');
    setIsAuthenticating(true);
    try {
      // 1. Authenticate against Supabase `app_users` table
      const remoteUser = await authenticateAppUserInSupabase(userStr, passStr);
      if (remoteUser) {
        onLoginSuccess(remoteUser);
        return;
      }

      // 2. Fallback check against loaded accounts
      const cleanUser = userStr.trim().toLowerCase();
      const matched = accounts.find(
        (acc) =>
          (acc.username.toLowerCase() === cleanUser ||
            (acc.employeeCode && acc.employeeCode.toLowerCase() === cleanUser)) &&
          acc.password === passStr
      );

      if (matched) {
        onLoginSuccess(matched);
        return;
      }

      setErrorMsg('Tên đăng nhập hoặc mật khẩu không chính xác.');
    } catch {
      const cleanUser = userStr.trim().toLowerCase();
      const matched = accounts.find(
        (acc) =>
          (acc.username.toLowerCase() === cleanUser ||
            (acc.employeeCode && acc.employeeCode.toLowerCase() === cleanUser)) &&
          acc.password === passStr
      );
      if (matched) {
        onLoginSuccess(matched);
      } else {
        setErrorMsg('Tên đăng nhập hoặc mật khẩu không chính xác.');
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await performLogin(username, password);
  };

  return (
    <div className="min-h-screen bg-[#0F232E] flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-700/30 p-7 sm:p-9">
        {/* Centered Brand Header */}
        <div className="flex flex-col items-center text-center mb-7">
          <div className="w-14 h-14 rounded-2xl bg-[#0F232E] border-2 border-[#0D9488] flex items-center justify-center text-[#2DD4BF] font-extrabold text-xl shadow-md mb-4">
            TS
          </div>
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight uppercase">
            PHÒNG KỸ THUẬT TRANSON
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">
            Hệ thống Quản lý Nhân sự &amp; Chấm công
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-[#FEF2F2] border border-red-200 text-xs font-medium text-[#EF4444] text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="login-username"
              className="block text-xs font-bold text-slate-700 mb-1.5"
            >
              Tên đăng nhập
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="login-username"
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập tên đăng nhập..."
                className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-[#0D9488] transition-colors"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-xs font-bold text-slate-700 mb-1.5"
            >
              Mật khẩu
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu..."
                className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-[#0D9488] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                data-testid="toggle-password-visibility"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isAuthenticating}
              data-testid="login-submit-btn"
              className="w-full py-2.5 px-4 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs sm:text-sm font-bold transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isAuthenticating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              <span>
                {isAuthenticating ? 'Đang đăng nhập...' : 'Đăng nhập hệ thống'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
