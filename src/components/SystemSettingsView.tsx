import React, { useState } from 'react';
import {
  Building2,
  FolderCog,
  UsersRound,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import {
  CompanyUnit,
  DepartmentGroup,
  Employee,
  UserAccount,
  UserRole,
} from '../types/hr';

interface SystemSettingsViewProps {
  companyUnits: CompanyUnit[];
  activeCompanyId: string;
  onSelectActiveCompany: (id: string) => void;
  onAddCompanyUnit: (unit: Omit<CompanyUnit, 'id'>) => void;
  onUpdateCompanyUnit: (id: string, unit: Omit<CompanyUnit, 'id'>) => void;
  onDeleteCompanyUnit: (id: string) => void;

  groups: DepartmentGroup[];
  employees: Employee[];
  defaultAnnualLeaveQuota: number;
  onChangeDefaultAnnualLeaveQuota: (quota: number) => void;
  onAddGroup: (grp: Omit<DepartmentGroup, 'id'>) => void;
  onUpdateGroup: (id: string, grp: Omit<DepartmentGroup, 'id'>) => void;
  onDeleteGroup: (id: string) => void;

  accounts: UserAccount[];
  currentAccountId: string;
  onAddAccount: (acc: Omit<UserAccount, 'id' | 'createdAt'>) => void;
  onUpdateAccountRole: (id: string, role: UserRole) => void;
  onDeleteAccount: (id: string) => void;
}

const GROUP_COLORS = [
  '#0D9488',
  '#0284C7',
  '#7C3AED',
  '#D97706',
  '#E11D48',
  '#16A34A',
];

export const SystemSettingsView: React.FC<SystemSettingsViewProps> = ({
  companyUnits,
  activeCompanyId,
  onSelectActiveCompany,
  onAddCompanyUnit,
  onUpdateCompanyUnit,
  onDeleteCompanyUnit,
  groups,
  employees,
  defaultAnnualLeaveQuota,
  onChangeDefaultAnnualLeaveQuota,
  onAddGroup,
  onUpdateGroup,
  onDeleteGroup,
  accounts,
  currentAccountId,
  onAddAccount,
  onUpdateAccountRole,
  onDeleteAccount,
}) => {
  // Card 1 State: Company Unit Form
  const [editingCompId, setEditingCompId] = useState<string | null>(null);
  const [compName, setCompName] = useState('');
  const [compCode, setCompCode] = useState('');
  const [compShortName, setCompShortName] = useState('HR');
  const [compAddress, setCompAddress] = useState('');
  const [compPhone, setCompPhone] = useState('');

  // Card 2 State: Department Group Form
  const [editingGrpId, setEditingGrpId] = useState<string | null>(null);
  const [grpName, setGrpName] = useState('');
  const [grpCode, setGrpCode] = useState('');
  const [grpColor, setGrpColor] = useState(GROUP_COLORS[0]);
  const [quotaInput, setQuotaInput] = useState<number>(defaultAnnualLeaveQuota);

  // Card 3 State: User Account Form
  const [accUsername, setAccUsername] = useState('');
  const [accFullName, setAccFullName] = useState('');
  const [accPassword, setAccPassword] = useState('123');
  const [accRole, setAccRole] = useState<UserRole>('user');
  const [accEmpCode, setAccEmpCode] = useState('');
  const [accDept, setAccDept] = useState(groups[0]?.name || 'Phòng Kỹ thuật & CNTT');

  // Handlers for Card 1 (Company Units)
  const startEditCompany = (unit: CompanyUnit) => {
    setEditingCompId(unit.id);
    setCompName(unit.name);
    setCompCode(unit.code);
    setCompShortName(unit.shortName);
    setCompAddress(unit.address);
    setCompPhone(unit.phone);
  };

  const resetCompanyForm = () => {
    setEditingCompId(null);
    setCompName('');
    setCompCode('');
    setCompShortName('HR');
    setCompAddress('');
    setCompPhone('');
  };

  const handleSaveCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!compName.trim()) return;
    const payload = {
      name: compName.trim(),
      code: compCode.trim().toUpperCase() || 'UNIT',
      shortName: compShortName.trim().toUpperCase().slice(0, 4) || 'HR',
      address: compAddress.trim() || 'Hà Nội',
      phone: compPhone.trim() || '024 3800 0000',
    };

    if (editingCompId) {
      onUpdateCompanyUnit(editingCompId, payload);
    } else {
      onAddCompanyUnit(payload);
    }
    resetCompanyForm();
  };

  // Handlers for Card 2 (Groups & Quota)
  const startEditGroup = (grp: DepartmentGroup) => {
    setEditingGrpId(grp.id);
    setGrpName(grp.name);
    setGrpCode(grp.code);
    setGrpColor(grp.color);
  };

  const resetGroupForm = () => {
    setEditingGrpId(null);
    setGrpName('');
    setGrpCode('');
    setGrpColor(GROUP_COLORS[0]);
  };

  const handleSaveGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!grpName.trim()) return;
    const payload = {
      name: grpName.trim(),
      code: grpCode.trim().toUpperCase() || 'DEP',
      color: grpColor,
    };
    if (editingGrpId) {
      onUpdateGroup(editingGrpId, payload);
    } else {
      onAddGroup(payload);
    }
    resetGroupForm();
  };

  // Handlers for Card 3 (User Accounts)
  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accUsername.trim() || !accFullName.trim()) return;
    onAddAccount({
      username: accUsername.trim(),
      fullName: accFullName.trim(),
      password: accPassword.trim() || '123',
      role: accRole,
      employeeCode: accEmpCode.trim().toUpperCase() || undefined,
      department: accDept,
    });
    setAccUsername('');
    setAccFullName('');
    setAccPassword('123');
    setAccEmpCode('');
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5">
        <h2 className="text-base md:text-lg font-bold text-slate-900">
          Cài đặt Đơn vị Công ty &amp; Hệ thống Quản trị
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Phân hệ dành riêng cho Quản trị viên (Admin): Quản lý danh mục Đơn vị/Chi nhánh, Phòng ban, Định mức phép chuẩn và Tài khoản phân quyền.
        </p>
      </div>

      {/* CARD 1: Quản lý Đơn vị / Chi nhánh công ty */}
      <section
        aria-label="Quản lý Đơn vị và Chi nhánh công ty"
        className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 space-y-4"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-teal-50 text-[#0D9488] flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                1. Quản lý Đơn vị / Chi nhánh Công ty ({companyUnits.length})
              </h3>
              <p className="text-xs text-slate-500">
                Hiển thị trong ô Dropdown &ldquo;CÔNG TY ĐANG LÀM VIỆC&rdquo; ở góc dưới Sidebar trái và trên tiêu đề Banner báo cáo
              </p>
            </div>
          </div>
        </div>

        {/* Form Add / Edit Company Unit */}
        <form
          onSubmit={handleSaveCompany}
          className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3"
        >
          <div className="text-xs font-bold text-slate-800">
            {editingCompId
              ? 'Chỉnh sửa thông tin Đơn vị / Chi nhánh'
              : 'Thêm Đơn vị / Chi nhánh Công ty mới'}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-5">
              <label
                htmlFor="comp-name-input"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Tên công ty / Chi nhánh *
              </label>
              <input
                id="comp-name-input"
                type="text"
                required
                value={compName}
                onChange={(e) => setCompName(e.target.value)}
                placeholder="VD: Chi nhánh HR PRO Hải Phòng"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#0D9488]"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="comp-code-input"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Mã đơn vị
              </label>
              <input
                id="comp-code-input"
                type="text"
                value={compCode}
                onChange={(e) => setCompCode(e.target.value)}
                placeholder="VD: HP-BR"
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#0D9488]"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="comp-short-input"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Logo / Viết tắt
              </label>
              <input
                id="comp-short-input"
                type="text"
                maxLength={4}
                value={compShortName}
                onChange={(e) => setCompShortName(e.target.value)}
                placeholder="VD: HR"
                className="w-full px-3 py-2 text-xs font-mono font-bold rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#0D9488]"
              />
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor="comp-phone-input"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Số điện thoại
              </label>
              <input
                id="comp-phone-input"
                type="text"
                value={compPhone}
                onChange={(e) => setCompPhone(e.target.value)}
                placeholder="VD: 0225 388 9999"
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#0D9488]"
              />
            </div>

            <div className="sm:col-span-9">
              <label
                htmlFor="comp-addr-input"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Địa chỉ trụ sở / Chi nhánh
              </label>
              <input
                id="comp-addr-input"
                type="text"
                value={compAddress}
                onChange={(e) => setCompAddress(e.target.value)}
                placeholder="Nhập địa chỉ chi tiết..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#0D9488]"
              />
            </div>

            <div className="sm:col-span-3 flex items-end gap-2">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                {editingCompId ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Lưu đơn vị</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm đơn vị</span>
                  </>
                )}
              </button>
              {editingCompId && (
                <button
                  type="button"
                  onClick={resetCompanyForm}
                  aria-label="Hủy sửa đơn vị"
                  className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </form>

        {/* Company Units Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0F232E] text-white uppercase text-[11px] font-semibold tracking-wider">
                <th className="py-2.5 px-3 w-16 text-center">Logo</th>
                <th className="py-2.5 px-3">Mã ĐV</th>
                <th className="py-2.5 px-3">Tên Đơn vị / Công ty thành viên</th>
                <th className="py-2.5 px-3">Địa chỉ</th>
                <th className="py-2.5 px-3">Điện thoại</th>
                <th className="py-2.5 px-3 text-center">Trạng thái chọn</th>
                <th className="py-2.5 px-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70">
              {companyUnits.map((unit) => {
                const isCurrent = unit.id === activeCompanyId;
                return (
                  <tr
                    key={unit.id}
                    className={
                      isCurrent ? 'bg-teal-50/50' : 'hover:bg-slate-50/80'
                    }
                  >
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#0F232E] text-[#2DD4BF] font-mono font-bold text-xs">
                        {unit.shortName}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#0D9488]">
                      {unit.code}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      {unit.name}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{unit.address}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">
                      {unit.phone}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {isCurrent ? (
                        <span className="text-xs font-bold text-[#0D9488]">
                          Đang làm việc
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSelectActiveCompany(unit.id)}
                          className="text-xs font-semibold text-slate-500 hover:text-[#0D9488] underline cursor-pointer"
                        >
                          Chuyển sang ĐV này
                        </button>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEditCompany(unit)}
                          aria-label={`Sửa đơn vị ${unit.name}`}
                          className="p-1.5 rounded-md text-slate-600 hover:text-[#0D9488] hover:bg-teal-50 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={companyUnits.length <= 1}
                          onClick={() => onDeleteCompanyUnit(unit.id)}
                          aria-label={`Xóa đơn vị ${unit.name}`}
                          className={`p-1.5 rounded-md ${
                            companyUnits.length <= 1
                              ? 'text-slate-300 cursor-not-allowed'
                              : 'text-[#EF4444] hover:bg-[#FEF2F2] cursor-pointer'
                          }`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* CARD 2: Quản lý Phòng ban / Nhóm & Cấu hình Phép chuẩn */}
      <section
        aria-label="Quản lý Phòng ban và Cấu hình Phép chuẩn"
        className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <FolderCog className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                2. Quản lý Phòng ban / Nhóm &amp; Cấu hình Phép chuẩn ({groups.length})
              </h3>
              <p className="text-xs text-slate-500">
                Thiết lập số ngày phép năm tiêu chuẩn mặc định và danh sách bộ phận
              </p>
            </div>
          </div>

          {/* Standard Annual Leave Quota Config */}
          <div className="flex items-center gap-2 bg-teal-50/70 border border-teal-200 px-3.5 py-2 rounded-xl">
            <label
              htmlFor="default-quota-input"
              className="text-xs font-bold text-slate-800 whitespace-nowrap"
            >
              Phép năm tiêu chuẩn mặc định:
            </label>
            <input
              id="default-quota-input"
              type="number"
              min={1}
              max={30}
              value={quotaInput}
              onChange={(e) => setQuotaInput(Number(e.target.value))}
              className="w-16 px-2 py-1 text-xs font-mono font-bold text-center rounded border border-teal-300 bg-white"
            />
            <span className="text-xs font-semibold text-slate-600">ngày/năm</span>
            <button
              type="button"
              onClick={() => onChangeDefaultAnnualLeaveQuota(quotaInput)}
              className="px-2.5 py-1 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Lưu định mức
            </button>
          </div>
        </div>

        {/* Add/Edit Department Form */}
        <form
          onSubmit={handleSaveGroup}
          className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
        >
          <div className="sm:col-span-5">
            <label
              htmlFor="settings-grp-name"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Tên Phòng ban / Bộ phận *
            </label>
            <input
              id="settings-grp-name"
              type="text"
              required
              value={grpName}
              onChange={(e) => setGrpName(e.target.value)}
              placeholder="VD: Phòng Marketing & Truyền thông"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#0D9488]"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="settings-grp-code"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Mã bộ phận
            </label>
            <input
              id="settings-grp-code"
              type="text"
              value={grpCode}
              onChange={(e) => setGrpCode(e.target.value)}
              placeholder="VD: MKT"
              className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#0D9488]"
            />
          </div>

          <div className="sm:col-span-2">
            <span className="block text-[11px] font-semibold text-slate-600 mb-1.5">
              Màu biểu đồ
            </span>
            <div className="flex items-center gap-1.5 py-1">
              {GROUP_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setGrpColor(c)}
                  aria-label={`Chọn màu bộ phận ${c}`}
                  className={`w-5 h-5 rounded-full cursor-pointer ${
                    grpColor === c ? 'ring-2 ring-offset-1 ring-slate-500 scale-110' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="sm:col-span-3 flex items-center gap-2">
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              {editingGrpId ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Cập nhật nhóm</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Thêm Phòng ban</span>
                </>
              )}
            </button>
            {editingGrpId && (
              <button
                type="button"
                onClick={resetGroupForm}
                className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>

        {/* Groups Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {groups.map((grp) => {
            const count = employees.filter((e) => e.department === grp.name).length;
            return (
              <div
                key={grp.id}
                className="p-3.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2 hover:bg-slate-50/70"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0"
                    style={{ backgroundColor: grp.color }}
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {grp.name}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">
                      Mã: {grp.code} · {count} nhân sự
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => startEditGroup(grp)}
                    aria-label={`Sửa bộ phận ${grp.name}`}
                    className="p-1.5 rounded-md text-slate-600 hover:text-[#0D9488] hover:bg-teal-50 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={count > 0}
                    onClick={() => onDeleteGroup(grp.id)}
                    aria-label={`Xóa bộ phận ${grp.name}`}
                    title={
                      count > 0
                        ? 'Không thể xóa bộ phận đang có nhân sự'
                        : 'Xóa bộ phận'
                    }
                    className={`p-1.5 rounded-md ${
                      count > 0
                        ? 'text-slate-300 cursor-not-allowed'
                        : 'text-[#EF4444] hover:bg-[#FEF2F2] cursor-pointer'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CARD 3: Quản lý Tài khoản đăng nhập (User Accounts) */}
      <section
        aria-label="Quản lý Tài khoản đăng nhập"
        className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 space-y-4"
      >
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
          <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
            <UsersRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              3. Quản lý Tài khoản Đăng nhập &amp; Phân quyền ({accounts.length})
            </h3>
            <p className="text-xs text-slate-500">
              Cấp tài khoản đăng nhập hệ thống và gán quyền Quản trị viên (Admin) hoặc Nhân viên (User)
            </p>
          </div>
        </div>

        {/* Create Account Form */}
        <form
          onSubmit={handleCreateAccount}
          className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
        >
          <div className="sm:col-span-2">
            <label
              htmlFor="acc-username-input"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Tên đăng nhập *
            </label>
            <input
              id="acc-username-input"
              type="text"
              required
              value={accUsername}
              onChange={(e) => setAccUsername(e.target.value)}
              placeholder="VD: nv005"
              className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#0D9488]"
            />
          </div>

          <div className="sm:col-span-3">
            <label
              htmlFor="acc-fullname-input"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Họ và tên người dùng *
            </label>
            <input
              id="acc-fullname-input"
              type="text"
              required
              value={accFullName}
              onChange={(e) => setAccFullName(e.target.value)}
              placeholder="VD: Vũ Đức Thịnh"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#0D9488]"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="acc-password-input"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Mật khẩu *
            </label>
            <input
              id="acc-password-input"
              type="text"
              required
              value={accPassword}
              onChange={(e) => setAccPassword(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#0D9488]"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="acc-role-select"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Vai trò phân quyền
            </label>
            <select
              id="acc-role-select"
              value={accRole}
              onChange={(e) => setAccRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#0D9488]"
            >
              <option value="user">User (Nhân viên)</option>
              <option value="admin">Admin (Quản trị viên)</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Tạo tài khoản</span>
            </button>
          </div>
        </form>

        {/* Accounts Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0F232E] text-white uppercase text-[11px] font-semibold tracking-wider">
                <th className="py-2.5 px-3">Tài khoản</th>
                <th className="py-2.5 px-3">Họ và tên</th>
                <th className="py-2.5 px-3">Mật khẩu</th>
                <th className="py-2.5 px-3">Bộ phận</th>
                <th className="py-2.5 px-3">Vai trò hiện tại</th>
                <th className="py-2.5 px-3 text-center">Đổi vai trò / Xóa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70">
              {accounts.map((acc) => {
                const isSelf = acc.id === currentAccountId;
                return (
                  <tr key={acc.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-3 font-mono font-bold text-[#0D9488]">
                      {acc.username}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      {acc.fullName}
                      {isSelf && (
                        <span className="ml-1.5 text-[11px] font-normal text-teal-600">
                          (Đang đăng nhập)
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">
                      {acc.password}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {acc.department || 'Toàn hệ thống'}
                    </td>
                    <td className="py-2.5 px-3">
                      {acc.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 font-bold text-[#0F766E]">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          QUẢN TRỊ VIÊN (Admin)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-sky-700">
                          <UserCheck className="w-3.5 h-3.5" />
                          NHÂN VIÊN (User)
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateAccountRole(
                              acc.id,
                              acc.role === 'admin' ? 'user' : 'admin'
                            )
                          }
                          className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer"
                        >
                          Đổi sang {acc.role === 'admin' ? 'User' : 'Admin'}
                        </button>
                        <button
                          type="button"
                          disabled={isSelf}
                          onClick={() => onDeleteAccount(acc.id)}
                          aria-label={`Xóa tài khoản ${acc.username}`}
                          className={`p-1.5 rounded-md ${
                            isSelf
                              ? 'text-slate-300 cursor-not-allowed'
                              : 'text-[#EF4444] hover:bg-[#FEF2F2] cursor-pointer'
                          }`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
