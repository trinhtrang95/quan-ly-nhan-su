import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Briefcase,
  Building,
  Check,
  FolderCog,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  CompanyDepartment,
  DepartmentGroup,
  Employee,
  PositionItem,
} from '../../types/hr';
import {
  createCompanyDepartment,
  deleteCompanyDepartment,
  fetchCompanyDepartments,
  subscribeToCompanyDepartmentsRealtime,
  updateCompanyDepartment,
} from '../../services/settingsService';
import { getFriendlyErrorMessage } from '../../utils/errorAndSecurityService';

const GROUP_COLORS = [
  '#0D9488',
  '#0284C7',
  '#7C3AED',
  '#D97706',
  '#E11D48',
  '#16A34A',
];

export interface CompanyOrgStructureTabProps {
  groups: DepartmentGroup[];
  positions: PositionItem[];
  employees: Employee[];
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
  onShowToast?: (message: string) => void;
}

export const CompanyOrgStructureTab: React.FC<CompanyOrgStructureTabProps> = ({
  groups,
  positions,
  employees,
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
  onShowToast,
}) => {
  // =========================================================================
  // KHỐI 1: BỘ PHẬN CẤP CÔNG TY (COMPANY DEPARTMENTS)
  // =========================================================================
  const [companyDepartments, setCompanyDepartments] = useState<CompanyDepartment[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [savingDept, setSavingDept] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [deptNameInput, setDeptNameInput] = useState('');
  const [deptCodeInput, setDeptCodeInput] = useState('');

  useEffect(() => {
    let active = true;
    setLoadingDepts(true);
    void fetchCompanyDepartments()
      .then((list) => {
        if (active) setCompanyDepartments(list);
      })
      .finally(() => {
        if (active) setLoadingDepts(false);
      });

    const unsub = subscribeToCompanyDepartmentsRealtime((latest) => {
      if (active) setCompanyDepartments(latest);
    });
    return () => {
      active = false;
      unsub();
    };
  }, []);

  const handleCompanyDeptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = deptNameInput.trim();
    if (!cleanName) return;

    setSavingDept(true);
    try {
      if (editingDeptId) {
        const updated = await updateCompanyDepartment(editingDeptId, {
          name: cleanName,
          code: deptCodeInput.trim() || undefined,
        });
        setCompanyDepartments((prev) =>
          prev.some((d) => d.id === updated.id)
            ? prev.map((d) => (d.id === updated.id ? updated : d))
            : [...prev, updated]
        );
        setEditingDeptId(null);
        onShowToast?.(`Đã cập nhật Bộ phận "${updated.name}".`);
      } else {
        const created = await createCompanyDepartment({
          name: cleanName,
          code: deptCodeInput.trim() || undefined,
        });
        setCompanyDepartments((prev) =>
          prev.some((d) => d.id === created.id)
            ? prev.map((d) => (d.id === created.id ? created : d))
            : [...prev, created]
        );
        onShowToast?.(`Đã thêm Bộ phận "${created.name}".`);
      }
      setDeptNameInput('');
      setDeptCodeInput('');
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setSavingDept(false);
    }
  };

  const startEditCompanyDept = (dept: CompanyDepartment) => {
    setEditingDeptId(dept.id);
    setDeptNameInput(dept.name);
    setDeptCodeInput(dept.code);
  };

  const handleDeleteCompanyDept = async (dept: CompanyDepartment) => {
    if (companyDepartments.length <= 1) {
      onShowToast?.('Cần giữ lại ít nhất 1 Bộ phận cấp công ty.');
      return;
    }
    try {
      await deleteCompanyDepartment(dept.id);
      setCompanyDepartments((prev) => prev.filter((d) => d.id !== dept.id));
      if (editingDeptId === dept.id) {
        setEditingDeptId(null);
        setDeptNameInput('');
        setDeptCodeInput('');
      }
      onShowToast?.(`Đã xóa Bộ phận "${dept.name}".`);
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    }
  };

  // =========================================================================
  // KHỐI 2: QUẢN LÝ NHÓM (BỘ PHẬN KỸ THUẬT) & QUỸ PHÉP & CHỨC DANH
  // =========================================================================
  const [editingGrpId, setEditingGrpId] = useState<string | null>(null);
  const [grpName, setGrpName] = useState('');
  const [grpCode, setGrpCode] = useState('');
  const [grpColor, setGrpColor] = useState(GROUP_COLORS[0]);
  const [quotaInput, setQuotaInput] = useState<number>(defaultAnnualLeaveQuota);

  const [editingPosId, setEditingPosId] = useState<string | null>(null);
  const [posNameInput, setPosNameInput] = useState('');

  useEffect(() => {
    setQuotaInput(defaultAnnualLeaveQuota);
  }, [defaultAnnualLeaveQuota]);

  const [draggedGroupIndex, setDraggedGroupIndex] = useState<number | null>(null);
  const [dragOverGroupIndex, setDragOverGroupIndex] = useState<number | null>(null);
  const [draggedPosIndex, setDraggedPosIndex] = useState<number | null>(null);
  const [dragOverPosIndex, setDragOverPosIndex] = useState<number | null>(null);

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

  return (
    <div className="space-y-5">
      {/* ===================================================================
          KHỐI 1: QUẢN LÝ BỘ PHẬN (CẤP CÔNG TY)
      =================================================================== */}
      <section
        aria-label="Quản lý Bộ phận cấp công ty"
        data-testid="company-departments-section"
        className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-[#14539E]">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Quản lý Bộ phận — Cấp công ty ({companyDepartments.length})
              </h3>
              <p className="text-xs text-slate-500">
                Danh mục các Bộ phận dùng chung toàn công ty (liên kết trực tiếp với mục Bộ phận YC trong Quản lý công việc ST)
              </p>
            </div>
          </div>
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200/80 text-[11px] font-semibold text-[#14539E] shrink-0">
            Cấp 1 · Toàn công ty
          </span>
        </div>

        {/* Add / Edit Company Department Form */}
        <form
          onSubmit={handleCompanyDeptSubmit}
          className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
        >
          <div className="sm:col-span-6">
            <label
              htmlFor="company-dept-name-input"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Tên Bộ phận *
            </label>
            <input
              id="company-dept-name-input"
              data-testid="company-dept-name-input"
              type="text"
              required
              value={deptNameInput}
              onChange={(e) => setDeptNameInput(e.target.value)}
              placeholder="VD: Kỹ thuật, Sản xuất, QC, Phát triển..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E]"
            />
          </div>

          <div className="sm:col-span-3">
            <label
              htmlFor="company-dept-code-input"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Mã Bộ phận
            </label>
            <input
              id="company-dept-code-input"
              data-testid="company-dept-code-input"
              type="text"
              value={deptCodeInput}
              onChange={(e) => setDeptCodeInput(e.target.value)}
              placeholder="VD: KT, SX, QC..."
              className="w-full px-3 py-2 text-xs font-mono uppercase rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E]"
            />
          </div>

          <div className="sm:col-span-3 flex items-center gap-2">
            <button
              type="submit"
              disabled={savingDept}
              data-testid="btn-submit-company-dept"
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#14539E] hover:bg-blue-700 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              {savingDept ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : editingDeptId ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              <span>{editingDeptId ? 'Lưu Bộ phận' : '+ Thêm Bộ phận'}</span>
            </button>
            {editingDeptId && (
              <button
                type="button"
                aria-label="Hủy sửa Bộ phận"
                onClick={() => {
                  setEditingDeptId(null);
                  setDeptNameInput('');
                  setDeptCodeInput('');
                }}
                className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </form>

        {/* Horizontal Card Grid of Company Departments */}
        {loadingDepts ? (
          <div className="mt-4 py-6 text-center text-xs text-slate-400">
            Đang tải danh sách Bộ phận...
          </div>
        ) : (
          <div
            data-testid="company-departments-grid"
            className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
          >
            {companyDepartments.map((dept, idx) => (
              <div
                key={dept.id}
                data-testid={`company-dept-card-${dept.code}`}
                className="p-3 rounded-xl border border-slate-200/90 bg-white hover:border-[#14539E]/50 hover:shadow-xs transition-all flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200/80 text-[#14539E] font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                    {dept.code}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {dept.name}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      Thứ tự #{idx + 1}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => startEditCompanyDept(dept)}
                    aria-label={`Sửa Bộ phận ${dept.name}`}
                    className="p-1.5 rounded-md text-slate-600 hover:text-[#14539E] hover:bg-blue-50 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={companyDepartments.length <= 1}
                    onClick={() => void handleDeleteCompanyDept(dept)}
                    aria-label={`Xóa Bộ phận ${dept.name}`}
                    className={`p-1.5 rounded-md ${
                      companyDepartments.length <= 1
                        ? 'text-slate-300 cursor-not-allowed'
                        : 'text-[#EF4444] hover:bg-[#FEF2F2] cursor-pointer'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ===================================================================
          KHỐI 2: QUẢN LÝ NHÓM (TRỰC THUỘC BỘ PHẬN KỸ THUẬT) & QUỸ PHÉP
      =================================================================== */}
      <section
        aria-label="Quản lý Nhóm trực thuộc Bộ phận Kỹ thuật và Cấu hình Phép chuẩn"
        data-testid="technical-groups-section"
        className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <FolderCog className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Quản lý Nhóm (Trực thuộc Bộ phận Kỹ thuật) &amp; Quỹ phép ({groups.length})
              </h3>
              <p className="text-xs text-slate-500">
                Thiết lập số ngày phép năm tiêu chuẩn mặc định và danh sách các Nhóm trực thuộc Bộ phận Kỹ thuật
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
                onChangeDefaultAnnualLeaveQuota(quotaInput > 0 ? quotaInput : 12)
              }
              className="px-2.5 py-1 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold cursor-pointer"
            >
              Lưu định mức
            </button>
          </div>
        </div>

        {/* Add / Edit Group Form */}
        <form
          onSubmit={handleGroupSubmit}
          className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
        >
          <div className="sm:col-span-5">
            <label
              htmlFor="grp-name-input"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Tên Nhóm *
            </label>
            <input
              id="grp-name-input"
              type="text"
              required
              value={grpName}
              onChange={(e) => setGrpName(e.target.value)}
              placeholder="VD: JIG/AUTO 2, AUTO 1, PE, ST..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#0D9488]"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="grp-code-input"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Mã Nhóm
            </label>
            <input
              id="grp-code-input"
              type="text"
              value={grpCode}
              onChange={(e) => setGrpCode(e.target.value)}
              placeholder="VD: ST, PE"
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
                  aria-label={`Chọn màu nhóm ${color}`}
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
              <span>{editingGrpId ? 'Lưu Nhóm' : '+ Thêm Nhóm'}</span>
            </button>
            {editingGrpId && (
              <button
                type="button"
                aria-label="Hủy sửa Nhóm"
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

        {/* Group Cards Grid (Draggable Priority Order - Tầng 1) */}
        {groups.length === 0 ? (
          <div className="mt-4 p-8 text-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
            Chưa có nhóm nào được tạo. Hãy nhập tên nhóm ở khung bên trên và bấm{' '}
            <strong>+ Thêm Nhóm</strong>.
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-teal-50/70 border border-teal-200/70 text-[11px] text-[#0F766E] font-medium">
              <span>
                💡 <strong>Kéo thả thẻ nhóm</strong> (hoặc bấm nút ↑ ↓) để thiết lập{' '}
                <strong>thứ tự ưu tiên sắp xếp mặc định Tầng 1</strong> trên bảng Danh sách nhân sự.
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
                        aria-label={`Đưa nhóm ${grp.name} lên trước`}
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
                        aria-label={`Đưa nhóm ${grp.name} xuống sau`}
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
                        aria-label={`Sửa nhóm ${grp.name}`}
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
                            ? 'Không thể xóa nhóm đang có nhân sự'
                            : 'Xóa nhóm'
                        }
                        aria-label={`Xóa nhóm ${grp.name}`}
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
                  aria-label="Hủy sửa chức danh"
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

          <div className="mt-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-teal-50/70 border border-teal-200/70 text-[11px] text-[#0F766E] font-medium">
              <span>
                💡 <strong>Kéo thả thẻ chức danh</strong> (hoặc bấm nút ↑ ↓) để thiết lập{' '}
                <strong>thứ tự ưu tiên sắp xếp Chức vụ trong cùng nhóm (Tầng 2)</strong>.
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
    </div>
  );
};
