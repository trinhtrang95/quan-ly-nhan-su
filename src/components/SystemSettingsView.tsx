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
  Copy,
  CloudUpload,
  Terminal,
  MonitorDown,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Palette,
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
import {
  SUPABASE_LEAVE_LOGS_SQL,
  uploadImageToHrBucket,
} from '../utils/supabaseService';
import { usePWAInstall } from '../utils/pwaInstall';
import {
  composeAddressFromParts,
  fetchCommunesForProvince,
  parseAddressIntoParts,
  VN_28_PROVINCES,
  VN_6_CENTRAL_CITIES,
} from '../utils/vnAddressData';
import {
  applyThemeToDocument,
  loadSavedThemeConfig,
  saveThemeConfig,
  THEME_PRESETS,
  ThemePresetId,
} from '../utils/themeManager';

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
  onReorderGroups?: (reorderedGroups: DepartmentGroup[]) => void;
  onAddPosition: (pos: Omit<PositionItem, 'id'>) => void;
  onUpdatePosition: (id: string, name: string) => void;
  onDeletePosition: (id: string) => void;
  onReorderPositions?: (reorderedPositions: PositionItem[]) => void;

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
  onSyncLocalToCloud?: () => Promise<void> | void;
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
  onReorderGroups,
  onAddPosition,
  onUpdatePosition,
  onDeletePosition,
  onReorderPositions,
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
  onSyncLocalToCloud,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>('units');
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);
  const { isInstalled, promptInstall } = usePWAInstall();
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  // Theme Customization State ("Màu giao diện")
  const [themeConfig, setThemeConfig] = useState(() => loadSavedThemeConfig());

  const handleSelectThemePreset = (presetId: ThemePresetId) => {
    const nextConfig = {
      ...themeConfig,
      preset: presetId,
    };
    setThemeConfig(nextConfig);
    saveThemeConfig(nextConfig);
    applyThemeToDocument(nextConfig);
  };

  const handleToggleAutoDark = (checked: boolean) => {
    const nextConfig = {
      ...themeConfig,
      autoDark: checked,
    };
    setThemeConfig(nextConfig);
    saveThemeConfig(nextConfig);
    applyThemeToDocument(nextConfig);
  };

  const handleInstallAppClick = async () => {
    const outcome = await promptInstall();
    if (outcome === 'unavailable') {
      setShowInstallGuide(true);
    }
  };

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_LEAVE_LOGS_SQL);
      setSqlCopied(true);
      setTimeout(() => setSqlCopied(false), 2500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = SUPABASE_LEAVE_LOGS_SQL;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setSqlCopied(true);
      setTimeout(() => setSqlCopied(false), 2500);
    }
  };

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

  // Drag-and-drop state for Department Groups (Tầng 1) & Positions (Tầng 2)
  const [draggedGroupIndex, setDraggedGroupIndex] = useState<number | null>(null);
  const [dragOverGroupIndex, setDragOverGroupIndex] = useState<number | null>(null);

  const [draggedPosIndex, setDraggedPosIndex] = useState<number | null>(null);
  const [dragOverPosIndex, setDragOverPosIndex] = useState<number | null>(null);

  const handleGroupDrop = (targetIndex: number) => {
    if (
      draggedGroupIndex === null ||
      draggedGroupIndex === targetIndex ||
      !onReorderGroups
    ) {
      setDraggedGroupIndex(null);
      setDragOverGroupIndex(null);
      return;
    }
    const next = [...groups];
    const [moved] = next.splice(draggedGroupIndex, 1);
    next.splice(targetIndex, 0, moved);
    onReorderGroups(next.map((g, idx) => ({ ...g, sortOrder: idx })));
    setDraggedGroupIndex(null);
    setDragOverGroupIndex(null);
  };

  const moveGroupByOffset = (index: number, offset: -1 | 1) => {
    if (!onReorderGroups) return;
    const targetIndex = index + offset;
    if (targetIndex < 0 || targetIndex >= groups.length) return;
    const next = [...groups];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    onReorderGroups(next.map((g, idx) => ({ ...g, sortOrder: idx })));
  };

  const handlePosDrop = (targetIndex: number) => {
    if (
      draggedPosIndex === null ||
      draggedPosIndex === targetIndex ||
      !onReorderPositions
    ) {
      setDraggedPosIndex(null);
      setDragOverPosIndex(null);
      return;
    }
    const next = [...positions];
    const [moved] = next.splice(draggedPosIndex, 1);
    next.splice(targetIndex, 0, moved);
    onReorderPositions(next.map((p, idx) => ({ ...p, sortOrder: idx })));
    setDraggedPosIndex(null);
    setDragOverPosIndex(null);
  };

  const movePosByOffset = (index: number, offset: -1 | 1) => {
    if (!onReorderPositions) return;
    const targetIndex = index + offset;
    if (targetIndex < 0 || targetIndex >= positions.length) return;
    const next = [...positions];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    onReorderPositions(next.map((p, idx) => ({ ...p, sortOrder: idx })));
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

        {/* Thẻ Cấu hình Ứng dụng Desktop / Mobile (PWA), Màu giao diện & Công cụ Đồng bộ Cloud */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-3">
          {/* MỤC QUẢN LÝ "MÀU GIAO DIỆN" (8 MÀU CHỦ ĐẠO + THEO MÁY DARK MODE) */}
          <div
            data-testid="theme-customization-card"
            className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/80 space-y-2.5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-[#0D9488] shrink-0" />
                <span className="text-xs sm:text-sm font-bold text-slate-900">
                  Màu giao diện
                </span>
                <span className="text-[11px] text-slate-500">
                  (Áp dụng ngay lập tức cho toàn bộ hệ thống)
                </span>
              </div>

              {/* Checkbox: Theo máy: tự chuyển nền tối khi máy để chế độ tối */}
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={themeConfig.autoDark}
                  onChange={(e) => handleToggleAutoDark(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-[#0D9488] cursor-pointer"
                />
                <span>Theo máy: tự chuyển nền tối khi máy để chế độ tối</span>
              </label>
            </div>

            {/* Danh sách 8 màu chủ đạo (Theme Presets) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
              {THEME_PRESETS.map((preset) => {
                const isSelected = themeConfig.preset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    data-testid={`theme-preset-${preset.id}`}
                    onClick={() => handleSelectThemePreset(preset.id)}
                    className={`flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white border-2 border-[#0D9488] text-slate-900 shadow-xs'
                        : 'bg-white/80 border-slate-200/90 text-slate-700 hover:bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10"
                        style={{ backgroundColor: preset.swatchColor }}
                        aria-hidden="true"
                      />
                      <span className="truncate">{preset.label}</span>
                    </div>
                    {isSelected && (
                      <Check
                        className="w-3.5 h-3.5 shrink-0"
                        style={{ color: preset.primary }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Thẻ Cài đặt Ứng dụng về máy (Desktop / Mobile) */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-[#0F232E] to-[#163546] text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <img
                src="/app-icon.svg"
                alt="Quản lý nhân sự"
                className="w-10 h-10 rounded-xl border border-teal-400/40 shrink-0 shadow-xs"
              />
              <div>
                <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                  <span>Ứng dụng Quản lý Nhân sự độc lập (Standalone App)</span>
                  {isInstalled && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-[10px] font-semibold text-emerald-300">
                      Đã cài đặt
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Cài đặt trực tiếp ra ngoài màn hình Desktop (Windows / Mac) và thanh Taskbar hoặc màn hình chính Điện thoại để sử dụng nhanh như phần mềm độc lập.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleInstallAppClick}
              data-testid="pwa-install-btn"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#0D9488] to-[#10B981] hover:from-[#0F766E] hover:to-[#059669] text-white text-xs font-bold shadow-sm transition-all shrink-0 cursor-pointer"
            >
              <MonitorDown className="w-4 h-4 shrink-0" />
              <span>💻 Cài đặt App về máy (Desktop / Mobile)</span>
            </button>
          </div>

          {/* Thanh công cụ Đồng bộ Cloud & Lấy mã SQL bảng Nghỉ phép */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="text-xs text-slate-600 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[#0D9488] shrink-0" />
              <span>
                Công cụ đồng bộ bảng <strong>leave_logs</strong> (Nghỉ phép &amp; Đi muộn) trên Supabase Cloud:
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {onSyncLocalToCloud && (
                <button
                  type="button"
                  disabled={isProcessingData}
                  onClick={onSyncLocalToCloud}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
                >
                  {isProcessingData ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CloudUpload className="w-3.5 h-3.5" />
                  )}
                  <span>Đồng bộ dữ liệu từ máy lên Cloud</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsSqlModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F232E] hover:bg-[#163546] text-white text-xs font-bold transition-colors cursor-pointer shadow-2xs"
              >
                <Terminal className="w-3.5 h-3.5 text-teal-300" />
                <span>Lấy mã SQL chuẩn hóa Bảng Nghỉ phép</span>
              </button>
            </div>
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

          {/* Department Cards Grid (Draggable Priority Order - Tầng 1) */}
          {groups.length === 0 ? (
            <div className="mt-4 p-8 text-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
              Chưa có phòng ban nào được tạo. Hãy nhập tên phòng ban ở khung bên trên và bấm <strong>+ Thêm Phòng ban</strong>.
            </div>
          ) : (
            <div className="mt-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-teal-50/70 border border-teal-200/70 text-[11px] text-[#0F766E] font-medium">
                <span>
                  💡 <strong>Kéo thả thẻ bộ phận</strong> (hoặc bấm nút ↑ ↓) để thiết lập <strong>thứ tự ưu tiên sắp xếp mặc định Tầng 1</strong> trên bảng Danh sách nhân sự.
                </span>
                <span className="font-mono font-bold shrink-0">
                  Ưu tiên #1 → #{groups.length}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {groups.map((grp, idx) => {
                  const count = employees.filter(
                    (e) => e.department === grp.name
                  ).length;
                  const isDragging = draggedGroupIndex === idx;
                  const isDragOver =
                    dragOverGroupIndex === idx && draggedGroupIndex !== idx;

                  return (
                    <div
                      key={grp.id}
                      draggable
                      onDragStart={(e) => {
                        setDraggedGroupIndex(idx);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (dragOverGroupIndex !== idx) {
                          setDragOverGroupIndex(idx);
                        }
                      }}
                      onDragLeave={() => {
                        if (dragOverGroupIndex === idx) {
                          setDragOverGroupIndex(null);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleGroupDrop(idx);
                      }}
                      onDragEnd={() => {
                        setDraggedGroupIndex(null);
                        setDragOverGroupIndex(null);
                      }}
                      className={`p-3 rounded-xl border bg-white flex items-center justify-between gap-2 transition-all cursor-grab active:cursor-grabbing select-none ${
                        isDragging
                          ? 'opacity-45 scale-[0.98] border-[#0D9488] bg-teal-50/40'
                          : isDragOver
                            ? 'border-2 border-dashed border-[#0D9488] bg-teal-50/60 shadow-md'
                            : 'border-slate-200/80 hover:border-[#0D9488]/60 hover:shadow-xs'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <GripVertical
                          className="w-4 h-4 text-slate-400 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-bold shrink-0 border border-slate-200">
                          #{idx + 1}
                        </span>
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

                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveGroupByOffset(idx, -1)}
                          title="Tăng độ ưu tiên (Đưa lên trước)"
                          aria-label={`Đưa bộ phận ${grp.name} lên trước`}
                          className={`p-1 rounded-md ${
                            idx === 0
                              ? 'text-slate-200 cursor-not-allowed'
                              : 'text-slate-500 hover:text-[#0D9488] hover:bg-teal-50 cursor-pointer'
                          }`}
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === groups.length - 1}
                          onClick={() => moveGroupByOffset(idx, 1)}
                          title="Giảm độ ưu tiên (Đưa xuống sau)"
                          aria-label={`Đưa bộ phận ${grp.name} xuống sau`}
                          className={`p-1 rounded-md ${
                            idx === groups.length - 1
                              ? 'text-slate-200 cursor-not-allowed'
                              : 'text-slate-500 hover:text-[#0D9488] hover:bg-teal-50 cursor-pointer'
                          }`}
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
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
            </div>
          )}

          {/* ===================================================================
              QUẢN LÝ CHỨC DANH / VỊ TRÍ (BẢNG POSITIONS TRÊN SUPABASE - KÉO THẢ TẦNG 2)
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
                  Khởi tạo, kéo thả thiết lập thứ tự ưu tiên Chức vụ (Tầng 2) và đồng bộ với bảng positions trên Supabase
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

            {/* Positions Grid (Draggable Priority Order - Tầng 2) */}
            <div className="mt-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-teal-50/70 border border-teal-200/70 text-[11px] text-[#0F766E] font-medium">
                <span>
                  💡 <strong>Kéo thả thẻ chức danh</strong> (hoặc bấm nút ↑ ↓) để thiết lập <strong>thứ tự ưu tiên sắp xếp Chức vụ trong cùng bộ phận (Tầng 2)</strong>.
                </span>
                <span className="font-mono font-bold shrink-0">
                  Ưu tiên #1 → #{positions.length}
                </span>
              </div>

              <div
                data-testid="positions-list-grid"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
              >
                {positions.map((pos, idx) => {
                  const empCountWithPos = employees.filter(
                    (e) => (e.position || 'Nhân viên') === pos.name
                  ).length;
                  const isDragging = draggedPosIndex === idx;
                  const isDragOver =
                    dragOverPosIndex === idx && draggedPosIndex !== idx;

                  return (
                    <div
                      key={pos.id}
                      draggable
                      onDragStart={(e) => {
                        setDraggedPosIndex(idx);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (dragOverPosIndex !== idx) {
                          setDragOverPosIndex(idx);
                        }
                      }}
                      onDragLeave={() => {
                        if (dragOverPosIndex === idx) {
                          setDragOverPosIndex(null);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        handlePosDrop(idx);
                      }}
                      onDragEnd={() => {
                        setDraggedPosIndex(null);
                        setDragOverPosIndex(null);
                      }}
                      className={`p-3 rounded-xl border bg-white flex items-center justify-between gap-2 transition-all cursor-grab active:cursor-grabbing select-none ${
                        isDragging
                          ? 'opacity-45 scale-[0.98] border-[#0D9488] bg-teal-50/40'
                          : isDragOver
                            ? 'border-2 border-dashed border-[#0D9488] bg-teal-50/60 shadow-md'
                            : 'border-slate-200/80 hover:border-[#0D9488]/60 hover:shadow-xs'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <GripVertical
                          className="w-4 h-4 text-slate-400 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="px-1.5 py-0.5 rounded bg-teal-50 text-[#0F766E] font-mono text-[10px] font-bold shrink-0 border border-teal-200">
                          #{idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            {pos.name}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {empCountWithPos} nhân sự
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => movePosByOffset(idx, -1)}
                          title="Tăng độ ưu tiên (Đưa lên trước)"
                          aria-label={`Đưa chức danh ${pos.name} lên trước`}
                          className={`p-1 rounded-md ${
                            idx === 0
                              ? 'text-slate-200 cursor-not-allowed'
                              : 'text-slate-500 hover:text-[#0D9488] hover:bg-teal-50 cursor-pointer'
                          }`}
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === positions.length - 1}
                          onClick={() => movePosByOffset(idx, 1)}
                          title="Giảm độ ưu tiên (Đưa xuống sau)"
                          aria-label={`Đưa chức danh ${pos.name} xuống sau`}
                          className={`p-1 rounded-md ${
                            idx === positions.length - 1
                              ? 'text-slate-200 cursor-not-allowed'
                              : 'text-slate-500 hover:text-[#0D9488] hover:bg-teal-50 cursor-pointer'
                          }`}
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
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

          {/* Khối Đồng bộ Cloud & Mã SQL Bảng leave_logs */}
          <div className="p-4 rounded-xl border border-teal-200 bg-teal-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <CloudUpload className="w-4 h-4 text-[#0D9488]" />
                <span>Đồng bộ Nghỉ phép &amp; Đi muộn từ trình duyệt lên Supabase Cloud</span>
              </div>
              <p className="text-xs text-slate-600">
                Đẩy toàn bộ các bản ghi Nghỉ phép &amp; Đi muộn hiện có trong máy (`localStorage`) lên bảng{' '}
                <code className="font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  public.leave_logs
                </code>{' '}
                trên Supabase hoặc lấy mã SQL để tạo đủ cột còn thiếu.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {onSyncLocalToCloud && (
                <button
                  type="button"
                  disabled={isProcessingData}
                  onClick={onSyncLocalToCloud}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  <CloudUpload className="w-3.5 h-3.5" />
                  <span>Đồng bộ dữ liệu từ máy lên Cloud</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsSqlModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F232E] hover:bg-[#163546] text-white text-xs font-bold transition-colors cursor-pointer"
              >
                <Terminal className="w-3.5 h-3.5 text-teal-300" />
                <span>Xem &amp; Sao chép mã SQL</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          HỘP THOẠI (MODAL) LẤY MÃ SQL CHUẨN HÓA BẢNG LEAVE_LOGS TRÊN SUPABASE
      ===================================================================== */}
      {isSqlModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mã SQL chuẩn hóa bảng Nghỉ phép và Đi muộn trên Supabase"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-[#0F232E] text-white flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <Terminal className="w-5 h-5 text-teal-300 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold truncate">
                    Mã SQL Chuẩn hóa Bảng Nghỉ phép &amp; Đi muộn (public.leave_logs)
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Dán đoạn mã này vào mục SQL Editor trên Supabase rồi bấm Run để tạo đủ cột
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSqlModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-3 flex-1 min-h-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700">
                  Cấu trúc chuẩn 100% khớp với API của hệ thống (bảng <code className="font-mono text-[#0D9488]">public.leave_logs</code>):
                </span>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                >
                  {sqlCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Đã sao chép mã SQL!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Sao chép mã SQL</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="p-4 rounded-xl bg-slate-900 text-teal-300 font-mono text-xs overflow-x-auto leading-relaxed select-all border border-slate-800">
                <code>{SUPABASE_LEAVE_LOGS_SQL}</code>
              </pre>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
              {onSyncLocalToCloud ? (
                <button
                  type="button"
                  disabled={isProcessingData}
                  onClick={onSyncLocalToCloud}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-50 hover:bg-teal-100 text-[#0F766E] border border-teal-200 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  <CloudUpload className="w-3.5 h-3.5" />
                  <span>Đồng bộ dữ liệu từ máy lên Cloud ngay</span>
                </button>
              ) : (
                <div />
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{sqlCopied ? 'Đã sao chép!' : 'Sao chép mã SQL'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsSqlModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PWA Installation Guide Modal */}
      {showInstallGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
          onClick={() => setShowInstallGuide(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl p-5 text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <img
                  src="/app-icon.svg"
                  alt="Quản lý nhân sự"
                  className="w-10 h-10 rounded-xl shadow-xs"
                />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Cài đặt Ứng dụng về Máy tính / Điện thoại
                  </h3>
                  <p className="text-xs text-slate-500">
                    Chạy độc lập ngoài màn hình Desktop &amp; Taskbar
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInstallGuide(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3.5 space-y-3 text-xs text-slate-600 leading-relaxed">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <p className="font-bold text-slate-800 mb-1">
                  💻 Trên máy tính (Chrome / Microsoft Edge / Cốc Cốc):
                </p>
                <p>
                  Nhấn vào biểu tượng <strong>Cài đặt (hình màn hình có mũi tên xuống)</strong> nằm ở góc bên phải của thanh địa chỉ trình duyệt (URL), sau đó chọn <strong>Cài đặt (Install)</strong>.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <p className="font-bold text-slate-800 mb-1">
                  📱 Trên iPhone / iPad / Mac (Safari):
                </p>
                <p>
                  Nhấn nút <strong>Chia sẻ (Share)</strong> trên thanh công cụ trình duyệt, sau đó chọn <strong>Thêm vào Màn hình chính (Add to Home Screen)</strong> hoặc <strong>Thêm vào Dock (Add to Dock)</strong>.
                </p>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowInstallGuide(false)}
                className="px-4 py-2 rounded-lg bg-[#0F232E] hover:bg-[#163546] text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
