import React, { useEffect, useRef, useState } from 'react';
import {
  Building2,
  FolderCog,
  Briefcase,
  UsersRound,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  ShieldCheck,
  UserCheck,
  Database,
  AlertTriangle,
  Upload,
  Download,
  FileJson,
  Loader2,
  Info,
} from 'lucide-react';
import {
  CompanyUnit,
  DepartmentGroup,
  Employee,
  HRBackupPayload,
  PositionItem,
  UserAccount,
  UserRole,
} from '../types/hr';
import { uploadImageToHrBucket } from '../utils/supabaseService';
import {
  composeAddressFromParts,
  fetchCommunesForProvince,
  parseAddressIntoParts,
  VN_28_PROVINCES,
  VN_6_CENTRAL_CITIES,
} from '../utils/vnAddressData';

export type SettingsSubTab = 'units' | 'departments' | 'accounts' | 'backup';

interface SystemSettingsViewProps {
  companyUnits: CompanyUnit[];
  activeCompanyId: string;
  onSelectActiveCompany: (id: string) => void;
  onAddCompanyUnit: (unit: Omit<CompanyUnit, 'id'>) => void;
  onUpdateCompanyUnit: (id: string, unit: Omit<CompanyUnit, 'id'>) => void;
  onDeleteCompanyUnit: (id: string) => void;

  groups: DepartmentGroup[];
  positions: PositionItem[];
  employees: Employee[];
  allEmployees: Employee[];
  defaultAnnualLeaveQuota: number;
  onChangeDefaultAnnualLeaveQuota: (quota: number) => void;
  onAddGroup: (grp: Omit<DepartmentGroup, 'id'>) => void;
  onUpdateGroup: (id: string, grp: Omit<DepartmentGroup, 'id'>) => void;
  onDeleteGroup: (id: string) => void;
  onAddPosition: (pos: Omit<PositionItem, 'id'>) => void;
  onUpdatePosition: (id: string, name: string) => void;
  onDeletePosition: (id: string) => void;

  accounts: UserAccount[];
  currentAccountId: string;
  onAddAccount: (acc: Omit<UserAccount, 'id' | 'createdAt'>) => void;
  onUpdateAccountRole: (id: string, role: UserRole) => void;
  onDeleteAccount: (id: string) => void;

  recordCount?: number;
  isProcessingData?: boolean;
  onDownloadBackup: () => void;
  onClearAllData: (autoBackupFirst: boolean) => Promise<void> | void;
  onRestoreFromBackupFile: (backup: HRBackupPayload) => Promise<void> | void;
}

const GROUP_COLORS = [
  '#0D9488',
  '#0284C7',
  '#7C3AED',
  '#D97706',
  '#E11D48',
  '#16A34A',
];

const SUB_TABS: {
  id: SettingsSubTab;
  label: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  { id: 'units', label: 'Đơn vị / Chi nhánh', icon: Building2 },
  { id: 'departments', label: 'Phòng ban & Quỹ phép', icon: FolderCog },
  { id: 'accounts', label: 'Tài khoản & Phân quyền', icon: UsersRound },
  { id: 'backup', label: 'Quản trị & Sao lưu Dữ liệu', icon: Database },
];

export const SystemSettingsView: React.FC<SystemSettingsViewProps> = ({
  companyUnits,
  activeCompanyId,
  onSelectActiveCompany,
  onAddCompanyUnit,
  onUpdateCompanyUnit,
  onDeleteCompanyUnit,
  groups,
  positions,
  employees,
  allEmployees,
  defaultAnnualLeaveQuota,
  onChangeDefaultAnnualLeaveQuota,
  onAddGroup,
  onUpdateGroup,
  onDeleteGroup,
  onAddPosition,
  onUpdatePosition,
  onDeletePosition,
  accounts,
  currentAccountId,
  onAddAccount,
  onUpdateAccountRole,
  onDeleteAccount,
  recordCount = 0,
  isProcessingData = false,
  onDownloadBackup,
  onClearAllData,
  onRestoreFromBackupFile,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>('units');

  // =========================================================================
  // TAB 1 STATE: COMPANY UNITS (Ảnh Logo, Tên Đơn vị, Địa chỉ, Số điện thoại)
  // =========================================================================
  const [editingCompId, setEditingCompId] = useState<string | null>(null);
  const [compName, setCompName] = useState('');
  const [compLogoUrl, setCompLogoUrl] = useState('');
  const [compProvince, setCompProvince] = useState('');
  const [compCommune, setCompCommune] = useState('');
  const [compAddress, setCompAddress] = useState('');
  const [compCommuneSuggestions, setCompCommuneSuggestions] = useState<string[]>([]);
  const [compPhone, setCompPhone] = useState('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Inline table editing for Company Unit
  const [inlineCompId, setInlineCompId] = useState<string | null>(null);
  const [inlineCompName, setInlineCompName] = useState('');
  const [inlineCompLogoUrl, setInlineCompLogoUrl] = useState('');
  const [inlineCompProvince, setInlineCompProvince] = useState('');
  const [inlineCompCommune, setInlineCompCommune] = useState('');
  const [inlineCompAddress, setInlineCompAddress] = useState('');
  const [inlineCompPhone, setInlineCompPhone] = useState('');
  const [isUploadingInlineLogo, setIsUploadingInlineLogo] = useState(false);

  useEffect(() => {
    if (!compProvince) {
      setCompCommuneSuggestions([]);
      return;
    }
    let active = true;
    fetchCommunesForProvince(compProvince).then((list) => {
      if (active) setCompCommuneSuggestions(list);
    });
    return () => {
      active = false;
    };
  }, [compProvince]);

  // =========================================================================
  // TAB 2 STATE: DEPARTMENTS, POSITIONS & DEFAULT LEAVE QUOTA
  // =========================================================================
  const [editingGrpId, setEditingGrpId] = useState<string | null>(null);
  const [grpName, setGrpName] = useState('');
  const [grpCode, setGrpCode] = useState('');
  const [grpColor, setGrpColor] = useState(GROUP_COLORS[0]);
  const [quotaInput, setQuotaInput] = useState<number>(defaultAnnualLeaveQuota);

  // Position (`positions` table) state
  const [editingPosId, setEditingPosId] = useState<string | null>(null);
  const [posNameInput, setPosNameInput] = useState('');

  useEffect(() => {
    setQuotaInput(defaultAnnualLeaveQuota);
  }, [defaultAnnualLeaveQuota]);

  // =========================================================================
  // TAB 3 STATE: USER ACCOUNTS (Bound to existing Employees)
  // =========================================================================
  // Filter employees who do NOT yet have an account in `accounts`
  const unassignedEmployees = allEmployees.filter(
    (emp) =>
      !accounts.some(
        (acc) => acc.username.toLowerCase() === emp.employeeCode.toLowerCase()
      )
  );

  const [selectedEmpIdForAcc, setSelectedEmpIdForAcc] = useState<string>('');
  const [accPassword, setAccPassword] = useState('123');
  const [accRole, setAccRole] = useState<UserRole>('user');

  // Keep selectedEmpIdForAcc synced with the first available unassigned employee
  useEffect(() => {
    if (unassignedEmployees.length > 0) {
      const stillValid = unassignedEmployees.some(
        (e) => e.id === selectedEmpIdForAcc
      );
      if (!stillValid) {
        setSelectedEmpIdForAcc(unassignedEmployees[0].id);
      }
    } else {
      setSelectedEmpIdForAcc('');
    }
  }, [unassignedEmployees, selectedEmpIdForAcc]);

  const selectedEmployeeForAccount = unassignedEmployees.find(
    (e) => e.id === selectedEmpIdForAcc
  );

  // =========================================================================
  // TAB 4 STATE: BACKUP, CLEAR ALL (WITH AUTO-BACKUP), RESTORE FROM .JSON
  // =========================================================================
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [autoBackupBeforeClear, setAutoBackupBeforeClear] = useState(true);
  const [backupErrorMsg, setBackupErrorMsg] = useState('');
  const backupFileInputRef = useRef<HTMLInputElement | null>(null);

  // =========================================================================
  // HANDLERS FOR TAB 1 (COMPANY UNITS)
  // =========================================================================
  const handleLogoFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    isInline = false
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (isInline) {
      setIsUploadingInlineLogo(true);
    } else {
      setIsUploadingLogo(true);
    }
    try {
      const uploadedUrl = await uploadImageToHrBucket(file, 'logos');
      if (isInline) {
        setInlineCompLogoUrl(uploadedUrl);
      } else {
        setCompLogoUrl(uploadedUrl);
      }
    } finally {
      if (isInline) {
        setIsUploadingInlineLogo(false);
      } else {
        setIsUploadingLogo(false);
      }
      e.target.value = '';
    }
  };

  const handleAddOrUpdateCompanySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = compName.trim();
    if (!cleanName) return;

    const fullCompanyAddress = composeAddressFromParts(
      compAddress,
      compCommune,
      compProvince
    );

    const unitPayload: Omit<CompanyUnit, 'id'> = {
      name: cleanName,
      code: `UNIT-${Date.now().toString().slice(-4)}`,
      shortName: 'TS',
      logoUrl: compLogoUrl || undefined,
      address: fullCompanyAddress,
      phone: compPhone.trim(),
    };

    if (editingCompId) {
      onUpdateCompanyUnit(editingCompId, unitPayload);
      setEditingCompId(null);
    } else {
      onAddCompanyUnit(unitPayload);
    }

    setCompName('');
    setCompLogoUrl('');
    setCompProvince('');
    setCompCommune('');
    setCompAddress('');
    setCompPhone('');
  };

  const startInlineEditCompany = (unit: CompanyUnit) => {
    const parsedAddr = parseAddressIntoParts(unit.address);
    setInlineCompId(unit.id);
    setInlineCompName(unit.name);
    setInlineCompLogoUrl(unit.logoUrl || '');
    setInlineCompProvince(parsedAddr.province);
    setInlineCompCommune(parsedAddr.commune);
    setInlineCompAddress(
      parsedAddr.province ? parsedAddr.detail : unit.address || ''
    );
    setInlineCompPhone(unit.phone || '');
  };

  const saveInlineEditCompany = (unit: CompanyUnit) => {
    const cleanName = inlineCompName.trim();
    if (!cleanName) return;
    const composedInlineAddress = composeAddressFromParts(
      inlineCompAddress,
      inlineCompCommune,
      inlineCompProvince
    );
    onUpdateCompanyUnit(unit.id, {
      name: cleanName,
      code: unit.code || 'UNIT',
      shortName: 'TS',
      logoUrl: inlineCompLogoUrl || undefined,
      address: composedInlineAddress,
      phone: inlineCompPhone.trim(),
      defaultLeaveQuota: unit.defaultLeaveQuota,
      isInitialized: unit.isInitialized,
    });
    setInlineCompId(null);
  };

  // =========================================================================
  // HANDLERS FOR TAB 2 (DEPARTMENTS & LEAVE QUOTA)
  // =========================================================================
  const handleGroupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = grpName.trim();
    if (!cleanName) return;

    const cleanCode =
      grpCode.trim().toUpperCase() ||
      cleanName
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 5);

    if (editingGrpId) {
      onUpdateGroup(editingGrpId, {
        name: cleanName,
        code: cleanCode,
        color: grpColor,
      });
      setEditingGrpId(null);
    } else {
      onAddGroup({
        name: cleanName,
        code: cleanCode,
        color: grpColor,
      });
    }

    setGrpName('');
    setGrpCode('');
    setGrpColor(GROUP_COLORS[(groups.length + 1) % GROUP_COLORS.length]);
  };

  const startEditGroup = (grp: DepartmentGroup) => {
    setEditingGrpId(grp.id);
    setGrpName(grp.name);
    setGrpCode(grp.code);
    setGrpColor(grp.color);
  };

  const handlePositionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPos = posNameInput.trim();
    if (!cleanPos) return;

    if (editingPosId) {
      onUpdatePosition(editingPosId, cleanPos);
      setEditingPosId(null);
    } else {
      onAddPosition({ name: cleanPos });
    }
    setPosNameInput('');
  };

  const startEditPosition = (pos: PositionItem) => {
    setEditingPosId(pos.id);
    setPosNameInput(pos.name);
  };

  // =========================================================================
  // HANDLERS FOR TAB 3 (USER ACCOUNTS FROM EMPLOYEES)
  // =========================================================================
  const handleCreateAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeForAccount || !accPassword.trim()) return;

    onAddAccount({
      username: selectedEmployeeForAccount.employeeCode,
      fullName: selectedEmployeeForAccount.fullName,
      password: accPassword.trim(),
      role: accRole,
      employeeCode: selectedEmployeeForAccount.employeeCode,
      department: selectedEmployeeForAccount.department,
    });

    setAccPassword('123');
    setAccRole('user');
  };

  // =========================================================================
  // HANDLERS FOR TAB 4 (BACKUP .JSON FILE UPLOAD)
  // =========================================================================
  const handleBackupFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setBackupErrorMsg('');
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as HRBackupPayload;
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        (!Array.isArray(parsed.employees) && !Array.isArray(parsed.companies))
      ) {
        setBackupErrorMsg(
          'File Backup (.json) không đúng định dạng của Hệ thống Quản lý Nhân sự & Chấm công.'
        );
        return;
      }
      await onRestoreFromBackupFile(parsed);
    } catch {
      setBackupErrorMsg(
        'Không thể đọc file Backup (.json). Vui lòng kiểm tra lại định dạng file.'
      );
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header & Sub-tabs Navigation Bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
              Cài đặt Đơn vị Công ty &amp; Hệ thống Quản trị
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Phân hệ dành riêng cho Quản trị viên (Admin): Quản lý Đơn vị/Chi nhánh, Phòng ban, Tài khoản và Sao lưu dữ liệu.
            </p>
          </div>

          {/* 4 Sub-tabs Navigation */}
          <div
            role="tablist"
            aria-label="Các mục cài đặt hệ thống"
            className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200/70"
          >
            {SUB_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  data-testid={`settings-subtab-${tab.id}`}
                  onClick={() => setActiveSubTab(tab.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#0D9488] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* =====================================================================
          TAB 1: ĐƠN VỊ / CHI NHÁNH CÔNG TY
      ===================================================================== */}
      {activeSubTab === 'units' && (
        <section
          aria-label="Quản lý Đơn vị và Chi nhánh công ty"
          className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5"
        >
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-[#0D9488]">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Quản lý Đơn vị / Chi nhánh Công ty ({companyUnits.length})
              </h3>
              <p className="text-xs text-slate-500">
                Tải ảnh Logo và cập nhật thông tin Đơn vị để đồng bộ lên Sidebar và Top Banner Header
              </p>
            </div>
          </div>

          {/* Add Company Form (Ảnh Logo, Tên Đơn vị, Địa chỉ, Số điện thoại) */}
          <form
            onSubmit={handleAddOrUpdateCompanySubmit}
            className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-4"
          >
            <div className="text-xs font-bold text-slate-800">
              Thêm Đơn vị / Chi nhánh Công ty mới
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              {/* Logo Upload Preview */}
              <div className="md:col-span-4 flex items-center gap-3.5">
                {compLogoUrl ? (
                  <img
                    src={compLogoUrl}
                    alt="Logo đơn vị"
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 rounded-xl object-cover border-2 border-[#0D9488] bg-white shrink-0 shadow-xs"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-[#0F232E] border-2 border-slate-300 flex items-center justify-center text-[#2DD4BF] font-extrabold text-sm shrink-0">
                    LOGO
                  </div>
                )}
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-slate-700">
                    Ảnh Logo Đơn vị
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer transition-colors">
                      {isUploadingLogo ? (
                        <Loader2 className="w-3.5 h-3.5 text-[#0D9488] animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5 text-[#0D9488]" />
                      )}
                      <span>
                        {isUploadingLogo ? 'Đang tải...' : 'Chọn ảnh Logo'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={isUploadingLogo}
                        onChange={(e) => handleLogoFileChange(e, false)}
                        className="hidden"
                      />
                    </label>
                    {compLogoUrl && (
                      <button
                        type="button"
                        onClick={() => setCompLogoUrl('')}
                        className="text-[11px] text-red-500 hover:underline cursor-pointer"
                      >
                        Xóa ảnh
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Tên Đơn vị & Số điện thoại */}
              <div className="md:col-span-5">
                <label
                  htmlFor="comp-name-input"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  Tên Đơn vị / Chi nhánh <span className="text-red-500">*</span>
                </label>
                <input
                  id="comp-name-input"
                  type="text"
                  required
                  value={compName}
                  onChange={(e) => setCompName(e.target.value)}
                  placeholder="VD: Công ty TNHH TransOn Việt Nam"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#0D9488]"
                />
              </div>

              <div className="md:col-span-3">
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
                  placeholder="VD: 024 3800 0000"
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#0D9488]"
                />
              </div>

              {/* Địa chỉ hành chính 2 cấp (34 Tỉnh/TP sau sáp nhập) & Nút Thêm */}
              <div className="md:col-span-3">
                <label
                  htmlFor="comp-addr-province"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  Tỉnh / Thành phố (34 Tỉnh/TP)
                </label>
                <select
                  id="comp-addr-province"
                  value={compProvince}
                  onChange={(e) => setCompProvince(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#0D9488]"
                >
                  <option value="">-- Chọn Tỉnh / Thành phố (34) --</option>
                  <optgroup label="6 Thành phố trực thuộc Trung ương">
                    {VN_6_CENTRAL_CITIES.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="28 Tỉnh">
                    {VN_28_PROVINCES.map((prov) => (
                      <option key={prov} value={prov}>
                        {prov}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="md:col-span-3">
                <label
                  htmlFor="comp-addr-commune"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  Xã / Phường / Đặc khu
                </label>
                <input
                  id="comp-addr-commune"
                  type="text"
                  list="comp-commune-datalist"
                  value={compCommune}
                  onChange={(e) => setCompCommune(e.target.value)}
                  placeholder={
                    compProvince
                      ? `Chọn/nhập Xã, Phường (${compProvince})...`
                      : 'Chọn hoặc nhập Xã/Phường...'
                  }
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#0D9488]"
                />
                <datalist id="comp-commune-datalist">
                  {compCommuneSuggestions.map((comm) => (
                    <option key={comm} value={comm} />
                  ))}
                </datalist>
              </div>

              <div className="md:col-span-3">
                <label
                  htmlFor="comp-address-input"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  Địa chỉ trụ sở / Chi nhánh chi tiết
                </label>
                <input
                  id="comp-address-input"
                  type="text"
                  value={compAddress}
                  onChange={(e) => setCompAddress(e.target.value)}
                  placeholder="Số nhà, Đường, KCN, Tòa nhà..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#0D9488]"
                />
              </div>

              <div className="md:col-span-3 flex items-end pt-4 md:pt-5">
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm đơn vị</span>
                </button>
              </div>
            </div>
          </form>

          {/* Company Units Table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#0F232E] text-white uppercase text-[11px] font-semibold tracking-wider">
                  <th className="py-2.5 px-3 w-20">Ảnh Logo</th>
                  <th className="py-2.5 px-3">Tên Đơn vị / Chi nhánh</th>
                  <th className="py-2.5 px-3">Địa chỉ</th>
                  <th className="py-2.5 px-3">Số điện thoại</th>
                  <th className="py-2.5 px-3 text-center">Trạng thái chọn</th>
                  <th className="py-2.5 px-3 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {companyUnits.map((unit) => {
                  const isActive = unit.id === activeCompanyId;
                  const isInlineEditing = inlineCompId === unit.id;

                  return (
                    <tr
                      key={unit.id}
                      className={
                        isActive ? 'bg-teal-50/40' : 'hover:bg-slate-50/80'
                      }
                    >
                      <td className="py-2.5 px-3">
                        {isInlineEditing ? (
                          <div className="flex items-center gap-2">
                            {inlineCompLogoUrl ? (
                              <img
                                src={inlineCompLogoUrl}
                                alt={unit.name}
                                referrerPolicy="no-referrer"
                                className="w-10 h-10 rounded-lg object-cover border border-[#0D9488] bg-white shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-[#0F232E] flex items-center justify-center text-[#2DD4BF] font-bold text-[10px] shrink-0">
                                TS
                              </div>
                            )}
                            <label className="px-2 py-1 rounded bg-white border border-slate-300 hover:bg-slate-50 text-[10px] font-semibold text-slate-700 cursor-pointer">
                              {isUploadingInlineLogo ? '...' : 'Đổi ảnh'}
                              <input
                                type="file"
                                accept="image/*"
                                disabled={isUploadingInlineLogo}
                                onChange={(e) => handleLogoFileChange(e, true)}
                                className="hidden"
                              />
                            </label>
                          </div>
                        ) : unit.logoUrl ? (
                          <img
                            src={unit.logoUrl}
                            alt={unit.name}
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-lg object-cover border border-slate-200 bg-white shadow-2xs"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-[#0F232E] flex items-center justify-center text-[#2DD4BF] font-extrabold text-xs">
                            TS
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {isInlineEditing ? (
                          <input
                            type="text"
                            value={inlineCompName}
                            onChange={(e) => setInlineCompName(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs rounded border border-[#0D9488] bg-white"
                          />
                        ) : (
                          unit.name
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-slate-600">
                        {isInlineEditing ? (
                          <div className="flex flex-col sm:flex-row gap-1.5">
                            <select
                              aria-label="Chọn Tỉnh/Thành phố cho đơn vị"
                              value={inlineCompProvince}
                              onChange={(e) =>
                                setInlineCompProvince(e.target.value)
                              }
                              className="px-2 py-1.5 text-xs rounded border border-[#0D9488] bg-white shrink-0"
                            >
                              <option value="">-- Tỉnh/TP (34) --</option>
                              <optgroup label="6 Thành phố trực thuộc Trung ương">
                                {VN_6_CENTRAL_CITIES.map((city) => (
                                  <option key={city} value={city}>
                                    {city}
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="28 Tỉnh">
                                {VN_28_PROVINCES.map((prov) => (
                                  <option key={prov} value={prov}>
                                    {prov}
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                            <input
                              type="text"
                              value={inlineCompCommune}
                              onChange={(e) =>
                                setInlineCompCommune(e.target.value)
                              }
                              placeholder="Xã / Phường..."
                              className="w-32 px-2 py-1.5 text-xs rounded border border-[#0D9488] bg-white"
                            />
                            <input
                              type="text"
                              value={inlineCompAddress}
                              onChange={(e) =>
                                setInlineCompAddress(e.target.value)
                              }
                              placeholder="Địa chỉ chi tiết..."
                              className="flex-1 min-w-[140px] px-2.5 py-1.5 text-xs rounded border border-[#0D9488] bg-white"
                            />
                          </div>
                        ) : (
                          unit.address || '—'
                        )}
                      </td>

                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {isInlineEditing ? (
                          <input
                            type="text"
                            value={inlineCompPhone}
                            onChange={(e) => setInlineCompPhone(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs font-mono rounded border border-[#0D9488] bg-white"
                          />
                        ) : (
                          unit.phone || '—'
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        {isActive ? (
                          <span className="font-bold text-[#0D9488]">
                            Đang làm việc
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onSelectActiveCompany(unit.id)}
                            className="text-slate-600 hover:text-[#0D9488] underline cursor-pointer font-medium"
                          >
                            Chuyển sang ĐV này
                          </button>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {isInlineEditing ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => saveInlineEditCompany(unit)}
                              className="px-2.5 py-1 rounded bg-[#0D9488] text-white text-[11px] font-semibold cursor-pointer"
                            >
                              Lưu
                            </button>
                            <button
                              type="button"
                              onClick={() => setInlineCompId(null)}
                              className="px-2 py-1 rounded border border-slate-300 text-slate-600 text-[11px] cursor-pointer"
                            >
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => startInlineEditCompany(unit)}
                              aria-label={`Sửa đơn vị ${unit.name}`}
                              className="p-1.5 rounded-md text-slate-600 hover:text-[#0D9488] hover:bg-slate-100 cursor-pointer"
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
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* =====================================================================
          TAB 2: PHÒNG BAN & QUỸ PHÉP CHUẨN
      ===================================================================== */}
      {activeSubTab === 'departments' && (
        <section
          aria-label="Quản lý Phòng ban và Cấu hình Phép chuẩn"
          className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <FolderCog className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Quản lý Phòng ban / Nhóm &amp; Cấu hình Phép chuẩn ({groups.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Thiết lập số ngày phép năm tiêu chuẩn mặc định và danh sách bộ phận của đơn vị
                </p>
              </div>
            </div>

            {/* Standard Annual Leave Quota Config */}
            <div className="flex items-center gap-2 bg-teal-50/70 border border-teal-200/80 px-3.5 py-2 rounded-xl">
              <label
                htmlFor="default-quota-input"
                className="text-xs font-bold text-slate-700 whitespace-nowrap"
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
                className="w-16 px-2 py-1 text-xs font-mono font-bold text-center rounded border border-teal-300 bg-white focus:outline-none focus:border-[#0D9488]"
              />
              <span className="text-xs text-slate-600">ngày/năm</span>
              <button
                type="button"
                onClick={() =>
                  onChangeDefaultAnnualLeaveQuota(
                    quotaInput > 0 ? quotaInput : 12
                  )
                }
                className="px-2.5 py-1 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold cursor-pointer"
              >
                Lưu định mức
              </button>
            </div>
          </div>

          {/* Add / Edit Department Form */}
          <form
            onSubmit={handleGroupSubmit}
            className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
          >
            <div className="sm:col-span-5">
              <label
                htmlFor="grp-name-input"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Tên Phòng ban / Bộ phận *
              </label>
              <input
                id="grp-name-input"
                type="text"
                required
                value={grpName}
                onChange={(e) => setGrpName(e.target.value)}
                placeholder="VD: Phòng Kỹ thuật & CNTT"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#0D9488]"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="grp-code-input"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Mã bộ phận
              </label>
              <input
                id="grp-code-input"
                type="text"
                value={grpCode}
                onChange={(e) => setGrpCode(e.target.value)}
                placeholder="VD: KT"
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#0D9488]"
              />
            </div>

            <div className="sm:col-span-2">
              <span className="block text-[11px] font-semibold text-slate-600 mb-1.5">
                Màu biểu đồ
              </span>
              <div className="flex items-center gap-1.5 py-1">
                {GROUP_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setGrpColor(color)}
                    aria-label={`Chọn màu bộ phận ${color}`}
                    className={`w-5 h-5 rounded-full transition-transform cursor-pointer ${
                      grpColor === color
                        ? 'scale-115 ring-2 ring-offset-1 ring-slate-700'
                        : 'opacity-75 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="sm:col-span-3 flex items-center gap-2">
              <button
                type="submit"
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                {editingGrpId ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span>{editingGrpId ? 'Lưu bộ phận' : '+ Thêm Phòng ban'}</span>
              </button>
              {editingGrpId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingGrpId(null);
                    setGrpName('');
                    setGrpCode('');
                  }}
                  className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </form>

          {/* Department Cards Grid */}
          {groups.length === 0 ? (
            <div className="mt-4 p-8 text-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
              Chưa có phòng ban nào được tạo. Hãy nhập tên phòng ban ở khung bên trên và bấm <strong>+ Thêm Phòng ban</strong>.
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {groups.map((grp) => {
                const count = employees.filter(
                  (e) => e.department === grp.name
                ).length;
                return (
                  <div
                    key={grp.id}
                    className="p-3.5 rounded-xl border border-slate-200/80 bg-white flex items-center justify-between gap-2 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: grp.color }}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {grp.name}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          Mã: {grp.code} · {count} nhân sự
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEditGroup(grp)}
                        aria-label={`Sửa bộ phận ${grp.name}`}
                        className="p-1.5 rounded-md text-slate-600 hover:text-[#0D9488] hover:bg-slate-100 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={count > 0}
                        onClick={() => onDeleteGroup(grp.id)}
                        title={
                          count > 0
                            ? 'Không thể xóa bộ phận đang có nhân sự'
                            : 'Xóa bộ phận'
                        }
                        aria-label={`Xóa bộ phận ${grp.name}`}
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
          )}

          {/* ===================================================================
              QUẢN LÝ CHỨC DANH / VỊ TRÍ (BẢNG POSITIONS TRÊN SUPABASE)
          =================================================================== */}
          <div className="mt-8 pt-6 border-t border-slate-200/80">
            <div className="flex items-center gap-3 pb-4">
              <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-[#0D9488]">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Quản lý Chức danh / Vị trí ({positions.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Khởi tạo và đồng bộ danh sách Chức danh / Vị trí với bảng positions trên Supabase (tự động cập nhật vào ô Dropdown trong form Nhân viên)
                </p>
              </div>
            </div>

            {/* Add / Edit Position Form */}
            <form
              onSubmit={handlePositionSubmit}
              className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
            >
              <div className="sm:col-span-9">
                <label
                  htmlFor="pos-name-input"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  Tên Chức danh / Vị trí *
                </label>
                <input
                  id="pos-name-input"
                  data-testid="pos-name-input"
                  type="text"
                  required
                  value={posNameInput}
                  onChange={(e) => setPosNameInput(e.target.value)}
                  placeholder="VD: Trưởng bộ phận, Trưởng nhóm, Phó nhóm, Nhân viên..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#0D9488]"
                />
              </div>

              <div className="sm:col-span-3 flex items-center gap-2">
                <button
                  type="submit"
                  data-testid="btn-submit-position"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  {editingPosId ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {editingPosId ? 'Lưu chức danh' : '+ Thêm Chức danh'}
                  </span>
                </button>
                {editingPosId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPosId(null);
                      setPosNameInput('');
                    }}
                    className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </form>

            {/* Positions Grid */}
            <div
              data-testid="positions-list-grid"
              className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
            >
              {positions.map((pos) => {
                const empCountWithPos = employees.filter(
                  (e) => (e.position || 'Nhân viên') === pos.name
                ).length;

                return (
                  <div
                    key={pos.id}
                    className="p-3.5 rounded-xl border border-slate-200/80 bg-white flex items-center justify-between gap-2 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#0D9488] shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {pos.name}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {empCountWithPos} nhân sự
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEditPosition(pos)}
                        aria-label={`Sửa chức danh ${pos.name}`}
                        className="p-1.5 rounded-md text-slate-600 hover:text-[#0D9488] hover:bg-slate-100 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={positions.length <= 1}
                        onClick={() => onDeletePosition(pos.id)}
                        aria-label={`Xóa chức danh ${pos.name}`}
                        className={`p-1.5 rounded-md ${
                          positions.length <= 1
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
          </div>
        </section>
      )}

      {/* =====================================================================
          TAB 3: TÀI KHOẢN & PHÂN QUYỀN (THEO MÃ NHÂN VIÊN CÓ SẴN)
      ===================================================================== */}
      {activeSubTab === 'accounts' && (
        <section
          aria-label="Quản lý Tài khoản đăng nhập"
          className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5"
        >
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
              <UsersRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Quản lý Tài khoản Đăng nhập &amp; Phân quyền ({accounts.length})
              </h3>
              <p className="text-xs text-slate-500">
                Chọn trực tiếp nhân sự từ danh sách hiện có để cấp tài khoản theo Mã Nhân Viên và phân quyền Admin / User
              </p>
            </div>
          </div>

          {/* Create Account from Existing Employee Dropdown */}
          {unassignedEmployees.length === 0 ? (
            <div
              data-testid="no-unassigned-employees-notice"
              className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200/90 flex items-center gap-3 text-xs text-amber-900"
            >
              <Info className="w-5 h-5 text-amber-600 shrink-0" />
              <span className="font-semibold">
                Vui lòng thêm hồ sơ nhân viên trong mục Quản lý Nhân sự trước khi cấp tài khoản đăng nhập.
              </span>
            </div>
          ) : (
            <form
              onSubmit={handleCreateAccountSubmit}
              className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
            >
              {/* Dropdown Select Employee Code */}
              <div className="sm:col-span-4">
                <label
                  htmlFor="acc-emp-select"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  Chọn Nhân sự (Mã NV làm Tên đăng nhập) *
                </label>
                <select
                  id="acc-emp-select"
                  value={selectedEmpIdForAcc}
                  onChange={(e) => setSelectedEmpIdForAcc(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#0D9488]"
                >
                  {unassignedEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.employeeCode} — {emp.fullName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Auto-filled Full Name */}
              <div className="sm:col-span-3">
                <label
                  htmlFor="acc-fullname-readonly"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  Họ và tên nhân viên (Tự động)
                </label>
                <input
                  id="acc-fullname-readonly"
                  type="text"
                  readOnly
                  value={selectedEmployeeForAccount?.fullName || ''}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-100 text-slate-700 cursor-not-allowed"
                />
              </div>

              {/* Password */}
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

              {/* Role */}
              <div className="sm:col-span-3 flex items-center gap-2">
                <div className="flex-1">
                  <label
                    htmlFor="acc-role-select"
                    className="block text-[11px] font-semibold text-slate-600 mb-1"
                  >
                    Vai trò
                  </label>
                  <select
                    id="acc-role-select"
                    value={accRole}
                    onChange={(e) => setAccRole(e.target.value as UserRole)}
                    className="w-full px-2.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#0D9488]"
                  >
                    <option value="user">User (Nhân viên)</option>
                    <option value="admin">Admin (Quản trị)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="mt-5 inline-flex items-center justify-center gap-1 px-3.5 py-2 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Cấp TK</span>
                </button>
              </div>
            </form>
          )}

          {/* Accounts Table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#0F232E] text-white uppercase text-[11px] font-semibold tracking-wider">
                  <th className="py-2.5 px-3">Tên đăng nhập (Mã NV)</th>
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
                  const isRootAdmin = acc.username.toLowerCase() === 'admin';
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
                            disabled={isRootAdmin && isSelf}
                            onClick={() =>
                              onUpdateAccountRole(
                                acc.id,
                                acc.role === 'admin' ? 'user' : 'admin'
                              )
                            }
                            className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Đổi sang {acc.role === 'admin' ? 'User' : 'Admin'}
                          </button>
                          <button
                            type="button"
                            disabled={isSelf || isRootAdmin}
                            onClick={() => onDeleteAccount(acc.id)}
                            aria-label={`Xóa tài khoản ${acc.username}`}
                            className={`p-1.5 rounded-md ${
                              isSelf || isRootAdmin
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
      )}

      {/* =====================================================================
          TAB 4: QUẢN TRỊ & SAO LƯU DỮ LIỆU (BACKUP / CLEAR / RESTORE .JSON)
      ===================================================================== */}
      {activeSubTab === 'backup' && (
        <section
          aria-label="Quản trị và Sao lưu dữ liệu"
          className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 space-y-5"
        >
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-[#0D9488]">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Quản trị Dữ liệu, Sao lưu (Backup) &amp; Khôi phục Hệ thống
              </h3>
              <p className="text-xs text-slate-500">
                Hiện có{' '}
                <strong className="font-mono text-slate-800">
                  {allEmployees.length}
                </strong>{' '}
                nhân sự và{' '}
                <strong className="font-mono text-slate-800">
                  {recordCount}
                </strong>{' '}
                bản ghi nghỉ phép/đi muộn trên hệ thống.
              </p>
            </div>
          </div>

          {backupErrorMsg && (
            <div className="p-3.5 rounded-xl bg-[#FEF2F2] border border-red-200 text-xs font-semibold text-[#EF4444]">
              {backupErrorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Sao lưu dữ liệu hiện tại về máy (.json) */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between gap-4">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-slate-900">
                  <Download className="w-4 h-4 text-[#0D9488]" />
                  <span>1. Sao lưu dữ liệu hiện tại</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Xuất toàn bộ dữ liệu hiện có (Đơn vị, Phòng ban, Danh sách nhân sự, Lịch sử nghỉ phép/đi muộn, Tài khoản) thành file{' '}
                  <code className="font-mono text-[11px] bg-white px-1 py-0.5 rounded border border-slate-200">
                    HR_Backup_YYYY-MM-DD.json
                  </code>{' '}
                  lưu về thư mục máy tính/điện thoại.
                </p>
              </div>
              <button
                type="button"
                disabled={isProcessingData}
                data-testid="download-backup-json-btn"
                onClick={onDownloadBackup}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>Tải file Sao lưu (Backup .json)</span>
              </button>
            </div>

            {/* 2. Khôi phục dữ liệu từ File Backup (.json) */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between gap-4">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-slate-900">
                  <FileJson className="w-4 h-4 text-sky-600" />
                  <span>2. Khôi phục từ file Backup (.json)</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Chọn file{' '}
                  <code className="font-mono text-[11px] bg-white px-1 py-0.5 rounded border border-slate-200">
                    .json
                  </code>{' '}
                  đã sao lưu trong thư mục máy tính hoặc điện thoại để nạp và đồng bộ toàn bộ dữ liệu trở lại hệ thống và đám mây Supabase.
                </p>
              </div>
              <div>
                <input
                  ref={backupFileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleBackupFileSelected}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isProcessingData}
                  data-testid="restore-backup-json-btn"
                  onClick={() => backupFileInputRef.current?.click()}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isProcessingData ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#0D9488]" />
                  ) : (
                    <Upload className="w-4 h-4 shrink-0 text-sky-600" />
                  )}
                  <span>
                    {isProcessingData
                      ? 'Đang nạp dữ liệu...'
                      : 'Khôi phục dữ liệu từ file Backup (.json)'}
                  </span>
                </button>
              </div>
            </div>

            {/* 3. Xóa trắng toàn bộ dữ liệu & Làm mới hệ thống */}
            <div className="p-4 rounded-xl border border-red-200 bg-[#FEF2F2]/60 flex flex-col justify-between gap-4">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-red-900">
                  <Trash2 className="w-4 h-4 text-[#EF4444]" />
                  <span>3. Xóa trắng &amp; Làm mới hệ thống</span>
                </div>
                <p className="text-xs text-red-800/90 leading-relaxed">
                  Xóa sạch danh sách nhân sự và lịch sử nghỉ phép trên cả máy và Supabase về 0 bản ghi (có tùy chọn tự động tải file Backup dữ liệu cũ về máy trước khi xóa).
                </p>
              </div>
              <button
                type="button"
                disabled={isProcessingData}
                data-testid="clear-all-data-btn"
                onClick={() => setConfirmClearOpen(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-red-300 bg-[#FEF2F2] hover:bg-red-100 text-[#EF4444] text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4 shrink-0" />
                <span>Xóa trắng dữ liệu &amp; Làm mới hệ thống</span>
              </button>
            </div>
          </div>

          {/* Confirmation Box for Clear All Data (with Auto-Backup Checkbox) */}
          {confirmClearOpen && (
            <div className="p-4 rounded-xl bg-[#FEF2F2] border border-red-200 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-[#EF4444] shrink-0 mt-0.5" />
                <div className="text-xs text-red-900 space-y-1">
                  <div className="font-bold text-sm">
                    Xác nhận xóa trắng toàn bộ dữ liệu nhân sự và lịch sử nghỉ phép?
                  </div>
                  <p className="text-red-700">
                    Sau khi xác nhận, toàn bộ danh sách nhân sự và lịch sử nghỉ phép trên cả máy tính và Supabase sẽ về 0 bản ghi.
                  </p>
                </div>
              </div>

              <div className="pl-7">
                <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoBackupBeforeClear}
                    onChange={(e) => setAutoBackupBeforeClear(e.target.checked)}
                    data-testid="auto-backup-before-clear-checkbox"
                    className="w-4 h-4 accent-[#0D9488] rounded cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    Tự động tải file Backup dữ liệu cũ về máy trước khi xóa trắng
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={isProcessingData}
                  onClick={() => setConfirmClearOpen(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={isProcessingData}
                  data-testid="confirm-clear-all-data-btn"
                  onClick={async () => {
                    await onClearAllData(autoBackupBeforeClear);
                    setConfirmClearOpen(false);
                  }}
                  className="px-4 py-2 rounded-lg bg-[#EF4444] hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
                >
                  {isProcessingData
                    ? 'Đang xử lý...'
                    : 'Xác nhận Xóa trắng & Làm mới'}
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
