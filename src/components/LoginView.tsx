import React, { useEffect, useState } from 'react';
import { Lock, User, LogIn, Eye, EyeOff, Loader2, Check } from 'lucide-react';
import { CompanyUnit, UserAccount } from '../types/hr';
import { authenticateAppUserInSupabase } from '../utils/supabaseService';

export const SAVED_CREDENTIALS_KEY = 'hr_pro_saved_credentials_v2';

interface SavedCredentials {
  username: string;
  password: string;
  rememberMe: boolean;
}

interface LoginViewProps {
  accounts: UserAccount[];
  activeCompany: CompanyUnit;
  isCloudConnected: boolean;
  onLoginSuccess: (account: UserAccount, rememberMe: boolean) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  accounts,
  activeCompany,
  onLoginSuccess,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Auto-fill saved username & password if previously remembered
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_CREDENTIALS_KEY);
      if (raw) {
        const parsed: SavedCredentials = JSON.parse(raw);
        if (parsed && parsed.rememberMe) {
          setUsername(parsed.username || '');
          setPassword(parsed.password || '');
          setRememberMe(true);
        }
      }
    } catch {
      // Ignore storage read errors
    }
  }, []);

  const performLogin = async (userStr: string, passStr: string) => {
    setErrorMsg('');
    setIsAuthenticating(true);
    try {
      let authenticatedAccount: UserAccount | null = null;

      // 1. Authenticate against Supabase `app_users` table
      const remoteUser = await authenticateAppUserInSupabase(userStr, passStr);
      if (remoteUser) {
        authenticatedAccount = remoteUser;
      } else {
        // 2. Fallback check against loaded accounts
        const cleanUser = userStr.trim().toLowerCase();
        const matched = accounts.find(
          (acc) =>
            (acc.username.toLowerCase() === cleanUser ||
              (acc.employeeCode &&
                acc.employeeCode.toLowerCase() === cleanUser)) &&
            acc.password === passStr
        );
        if (matched) {
          authenticatedAccount = matched;
        }
      }

      if (!authenticatedAccount) {
        setErrorMsg('Tên đăng nhập hoặc mật khẩu không chính xác.');
        return;
      }

      // Persist or clear saved credentials based on `rememberMe`
      try {
        if (rememberMe) {
          const toSave: SavedCredentials = {
            username: userStr.trim(),
            password: passStr,
            rememberMe: true,
          };
          localStorage.setItem(SAVED_CREDENTIALS_KEY, JSON.stringify(toSave));
        } else {
          localStorage.removeItem(SAVED_CREDENTIALS_KEY);
        }
      } catch {
        // Ignore storage errors
      }

      onLoginSuccess(authenticatedAccount, rememberMe);
    } catch {
      const cleanUser = userStr.trim().toLowerCase();
      const matched = accounts.find(
        (acc) =>
          (acc.username.toLowerCase() === cleanUser ||
            (acc.employeeCode && acc.employeeCode.toLowerCase() === cleanUser)) &&
          acc.password === passStr
      );
      if (matched) {
        try {
          if (rememberMe) {
            localStorage.setItem(
              SAVED_CREDENTIALS_KEY,
              JSON.stringify({
                username: userStr.trim(),
                password: passStr,
                rememberMe: true,
              })
            );
          } else {
            localStorage.removeItem(SAVED_CREDENTIALS_KEY);
          }
        } catch {
          // Ignore storage errors
        }
        onLoginSuccess(matched, rememberMe);
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
      <div className="w-full max-w-sm mx-auto bg-white rounded-2xl shadow-2xl border border-slate-700/30 p-6 flex flex-col gap-4">
        {/* Centered Brand Header */}
        <div className="flex flex-col items-center text-center">
          <img
            src="/app-icon.svg"
            alt="Quản lý nhân sự"
            className="w-16 h-16 rounded-2xl object-cover border border-teal-500/40 shadow-md mb-3"
          />
          <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight leading-snug">
            Hệ thống Quản lý Nhân sự &amp; Chấm công
          </h1>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-[#FEF2F2] border border-red-200 text-xs font-medium text-[#EF4444] text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
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

          {/* Checkbox: Lưu tài khoản đăng nhập */}
          <div className="pt-0.5">
            <label
              htmlFor="remember-account-checkbox"
              className="inline-flex items-center gap-2.5 cursor-pointer select-none group"
            >
              <div className="relative flex items-center justify-center">
                <input
                  id="remember-account-checkbox"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  data-testid="remember-account-checkbox"
                  className="peer sr-only"
                />
                <div className="w-4 h-4 rounded border border-slate-300 bg-white peer-checked:bg-[#0D9488] peer-checked:border-[#0D9488] transition-colors flex items-center justify-center">
                  <Check
                    className={`w-3 h-3 text-white transition-opacity ${
                      rememberMe ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-700 group-hover:text-slate-900">
                Lưu tài khoản đăng nhập
              </span>
            </label>
          </div>

          <div className="pt-1">
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
