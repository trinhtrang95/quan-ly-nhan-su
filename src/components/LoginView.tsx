import React, { useState } from 'react';
import {
  ShieldCheck,
  UserCheck,
  Lock,
  User,
  LogIn,
  Cloud,
  CheckCircle2,
} from 'lucide-react';
import { CompanyUnit, UserAccount } from '../types/hr';

interface LoginViewProps {
  accounts: UserAccount[];
  activeCompany: CompanyUnit;
  isCloudConnected: boolean;
  onLoginSuccess: (account: UserAccount) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  accounts,
  activeCompany,
  isCloudConnected,
  onLoginSuccess,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanUser = username.trim().toLowerCase();
    const matched = accounts.find(
      (acc) =>
        (acc.username.toLowerCase() === cleanUser ||
          (acc.employeeCode && acc.employeeCode.toLowerCase() === cleanUser)) &&
        acc.password === password
    );

    if (!matched) {
      setErrorMsg(
        'Tài khoản/Mã NV hoặc mật khẩu không chính xác. Bạn có thể bấm nút Đăng nhập nhanh Demo bên dưới.'
      );
      return;
    }

    onLoginSuccess(matched);
  };

  const handleDemoLogin = (role: 'admin' | 'user') => {
    setErrorMsg('');
    const target =
      accounts.find((a) => a.role === role) ||
      (role === 'admin'
        ? {
            id: 'acc-admin-demo',
            username: 'admin',
            password: '123',
            fullName: 'Trần Thu Trang',
            role: 'admin' as const,
            employeeCode: 'NV002',
            department: 'Phòng Hành chính - Nhân sự',
            createdAt: '2025-01-10',
          }
        : {
            id: 'acc-user-demo',
            username: 'user',
            password: '123',
            fullName: 'Lê Hoàng Nam',
            role: 'user' as const,
            employeeCode: 'NV003',
            department: 'Phòng Kỹ thuật & CNTT',
            createdAt: '2025-02-15',
          });
    onLoginSuccess(target);
  };

  return (
    <div className="min-h-screen bg-[#0F232E] flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-700/40">
        {/* Left Branding Panel */}
        <div className="lg:col-span-5 bg-[#0B1B24] text-white p-7 sm:p-8 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#0D9488] flex items-center justify-center text-white font-extrabold text-base shadow-sm">
                {activeCompany.shortName || 'HR'}
              </div>
              <div>
                <div className="text-lg font-extrabold tracking-tight text-white">
                  HR PRO
                </div>
                <div className="text-xs text-[#2DD4BF] font-medium">
                  Hệ thống Quản lý Nhân sự &amp; Chấm công Phép
                </div>
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <h1 className="text-xl sm:text-2xl font-bold text-white leading-snug">
                Quản trị Hồ sơ Nhân sự &amp; Quỹ Phép Năm Tập trung
              </h1>
              <p className="text-xs text-slate-300 leading-relaxed">
                Đồng bộ dữ liệu thời gian thực trên nền tảng đám mây Supabase giữa máy tính văn phòng (PC 16:9) và điện thoại di động.
              </p>
            </div>

            <div className="space-y-2.5 pt-2 text-xs text-slate-300">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#2DD4BF] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Quyền Quản trị viên (Admin):</strong> Toàn quyền quản lý nhân sự, phê duyệt/xóa phép, xuất báo cáo và cấu hình đơn vị công ty.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#2DD4BF] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Quyền Nhân viên (User):</strong> Tra cứu bảng công, tạo phiếu xin nghỉ phép / đi muộn và chụp ảnh giấy phép trực tiếp từ điện thoại.
                </span>
              </div>
            </div>
          </div>

          <div className="pt-6 mt-6 border-t border-slate-800/80 space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Đơn vị đang kết nối
            </div>
            <div className="text-xs font-bold text-white truncate">
              {activeCompany.name}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[#2DD4BF] font-medium pt-1">
              <Cloud className="w-3.5 h-3.5" />
              <span>
                {isCloudConnected
                  ? 'Đã kết nối Cloud (Supabase)'
                  : 'Chế độ Offline (Local)'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Login Form Panel */}
        <div className="lg:col-span-7 p-7 sm:p-9 bg-white flex flex-col justify-center">
          <div className="mb-6">
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
              Đăng nhập Hệ thống
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Nhập Tài khoản hoặc Mã nhân viên (VD: <span className="font-mono font-semibold text-slate-700">admin</span> / <span className="font-mono font-semibold text-slate-700">user</span>, mật khẩu: <span className="font-mono font-semibold text-slate-700">123</span>)
            </p>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-lg bg-[#FEF2F2] border border-red-200 text-xs font-medium text-[#EF4444]">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-username"
                className="block text-xs font-bold text-slate-700 mb-1.5"
              >
                Tài khoản hoặc Mã nhân viên
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Nhập admin, user hoặc Mã NV (VD: NV002)..."
                  className="w-full pl-10 pr-4 py-2.5 text-xs rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-[#0D9488] transition-colors"
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
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu (mặc định: 123)..."
                  className="w-full pl-10 pr-4 py-2.5 text-xs rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-[#0D9488] transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Đăng nhập Hệ thống</span>
            </button>
          </form>

          {/* 2 Quick Demo Login Buttons */}
          <div className="mt-6 pt-6 border-t border-slate-200/80">
            <div className="text-xs font-bold text-slate-700 mb-3">
              Đăng nhập nhanh Demo (1-Click Kiểm thử Phân quyền):
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                data-testid="demo-login-admin"
                onClick={() => handleDemoLogin('admin')}
                className="p-3.5 rounded-xl border-2 border-[#0D9488] bg-teal-50/60 hover:bg-teal-100/70 text-left transition-colors group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#0F232E]">
                    <ShieldCheck className="w-4 h-4 text-[#0D9488]" />
                    <span>Vào nhanh quyền ADMIN</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold text-[#0F766E]">
                    Full Access
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 mt-1">
                  Trần Thu Trang (NV002) · Toàn quyền Thêm/Sửa/Xóa &amp; Cài đặt
                </div>
              </button>

              <button
                type="button"
                data-testid="demo-login-user"
                onClick={() => handleDemoLogin('user')}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left transition-colors group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-800">
                    <UserCheck className="w-4 h-4 text-sky-600" />
                    <span>Vào nhanh quyền USER</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold text-sky-700">
                    Nhân viên
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 mt-1">
                  Lê Hoàng Nam (NV003) · Xem báo cáo &amp; Ghi nhận phép / Chụp đơn
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
