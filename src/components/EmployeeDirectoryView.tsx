import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  FileText,
  ClipboardCheck,
  FileSpreadsheet,
  Download,
  Upload,
  UserPlus,
  Trash2,
  Search,
  Pencil,
  RotateCcw,
  AlertTriangle,
  X,
  Eye,
  ChevronDown,
} from 'lucide-react';
import { DepartmentGroup, Employee, LeaveRecord } from '../types/hr';
import {
  EmployeeSortField,
  filterEmployees,
  formatDateVN,
  SortDirection,
  sortEmployees,
} from '../utils/hrCalculations';
import { formatCommuneProvinceAddress } from '../utils/vnAddressData';
import {
  EmployeeProfileDrawer,
  renderStatusBadge,
} from './EmployeeProfileDrawer';

interface EmployeeDirectoryViewProps {
  employees: Employee[];
  records?: LeaveRecord[];
  groups: DepartmentGroup[];
  isAdmin?: boolean;
  selectedIds: string[];
  importErrorMsg?: string | null;
  onClearImportError?: () => void;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (ids: string[]) => void;
  onDeleteSelected: () => void;
  onDeleteSingle: (emp: Employee) => void;
  onOpenAddEmployee: () => void;
  onOpenEditEmployee: (emp: Employee) => void;
  onExportPDF: (filteredEmployees: Employee[]) => void;
  onExportPDFSignList: (filteredEmployees: Employee[]) => void;
  onExportExcel: (filteredEmployees: Employee[]) => void;
  onDownloadTemplate: () => void;
  onImportExcelFile: (file: File) => void;
  onInspectAttachment?: (url: string, title: string) => void;
}

export const EmployeeDirectoryView: React.FC<EmployeeDirectoryViewProps> = ({
  employees,
  records = [],
  groups,
  isAdmin = true,
  selectedIds,
  importErrorMsg,
  onClearImportError,
  onToggleSelect,
  onToggleSelectAll,
  onDeleteSelected,
  onDeleteSingle,
  onOpenAddEmployee,
  onOpenEditEmployee,
  onExportPDF,
  onExportPDFSignList,
  onExportExcel,
  onDownloadTemplate,
  onImportExcelFile,
  onInspectAttachment,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [genderStatusFilter, setGenderStatusFilter] = useState('ALL');
  const [sortField, setSortField] = useState<EmployeeSortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [drawerEmployeeId, setDrawerEmployeeId] = useState<string | null>(null);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        exportDropdownRef.current &&
        !exportDropdownRef.current.contains(e.target as Node)
      ) {
        setIsExportDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Set of registered group names from Settings
  const registeredGroupNames = useMemo(
    () => new Set(groups.map((g) => g.name)),
    [groups]
  );

  // Normalize employees so any unregistered department is treated as empty ""
  const normalizedEmployees = useMemo(
    () =>
      employees.map((emp) => ({
        ...emp,
        department:
          emp.department && registeredGroupNames.has(emp.department)
            ? emp.department
            : '',
      })),
    [employees, registeredGroupNames]
  );

  const filteredEmployees = useMemo(
    () =>
      filterEmployees(
        normalizedEmployees,
        searchQuery,
        departmentFilter,
        genderStatusFilter
      ),
    [normalizedEmployees, searchQuery, departmentFilter, genderStatusFilter]
  );

  const sortedEmployees = useMemo(
    () => sortEmployees(filteredEmployees, sortField, sortDirection),
    [filteredEmployees, sortField, sortDirection]
  );

  const activeDrawerEmployee = useMemo(
    () =>
      drawerEmployeeId
        ? normalizedEmployees.find((e) => e.id === drawerEmployeeId) || null
        : null,
    [drawerEmployeeId, normalizedEmployees]
  );

  const allFilteredSelected =
    sortedEmployees.length > 0 &&
    sortedEmployees.every((emp) => selectedIds.includes(emp.id));

  const handleSortClick = (field: EmployeeSortField) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else {
      setSortField(null);
      setSortDirection(null);
    }
  };

  const renderSortIndicator = (field: EmployeeSortField) => {
    const isActive = sortField === field && sortDirection !== null;
    if (!isActive) {
      return (
        <span
          aria-hidden="true"
          className="text-[9px] text-slate-300/80 group-hover/th:text-teal-300 transition-colors ml-1"
        >
          ▲▼
        </span>
      );
    }
    return (
      <span
        aria-hidden="true"
        className="text-[10px] text-[#2DD4BF] font-bold ml-1"
      >
        {sortDirection === 'asc' ? '▲' : '▼'}
      </span>
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportExcelFile(file);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Hidden file input for Excel/CSV Import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xls,.xlsx,.txt"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Tải tệp Excel nhập nhân sự"
      />

      {/* Import / Duplicate Code Error Banner */}
      {importErrorMsg && (
        <div
          role="alert"
          data-testid="employee-import-error-banner"
          className="bg-[#FEF2F2] border border-red-300 text-[#B91C1C] px-4 py-3 rounded-xl flex items-start justify-between gap-3 text-xs font-medium shadow-xs"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
            <div>{importErrorMsg}</div>
          </div>
          {onClearImportError && (
            <button
              type="button"
              onClick={onClearImportError}
              aria-label="Đóng thông báo lỗi"
              className="p-1 rounded-md text-red-500 hover:bg-red-100 cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Action Header Card (Chuẩn hóa tiêu đề "Danh sách nhân sự" & gom nhóm công cụ toolbar) */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-4 md:p-5">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          {/* Left: Title only ("Danh sách nhân sự", xóa bỏ hoàn toàn badge số lượng) */}
          <div className="flex items-center gap-3">
            <h2 className="text-base md:text-lg font-bold text-slate-900">
              Danh sách nhân sự
            </h2>
          </div>

          {/* Right: Exactly 2 fixed buttons (Xuất/Nhập dữ liệu ▾ and + Thêm nhân sự) + Conditional Delete Selected button */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Conditional "Xóa đã chọn" button: Only shown when selectedIds.length > 0 */}
            {isAdmin && selectedIds.length > 0 && (
              <button
                type="button"
                data-testid="btn-delete-selected"
                onClick={onDeleteSelected}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 bg-[#FEF2F2] hover:bg-red-100 text-[#EF4444] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs animate-pulse"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa đã chọn ({selectedIds.length})</span>
              </button>
            )}

            {/* Dropdown Menu "Xuất / Nhập dữ liệu ▾" */}
            <div className="relative" ref={exportDropdownRef}>
              <button
                type="button"
                data-testid="btn-export-import-dropdown"
                onClick={() => setIsExportDropdownOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#0D9488]" />
                <span>Xuất / Nhập dữ liệu</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {isExportDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-60 bg-white rounded-xl border border-slate-200 shadow-xl py-1.5 z-50 text-xs font-medium text-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      setIsExportDropdownOpen(false);
                      onExportPDF(sortedEmployees);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-teal-50 hover:text-[#0D9488] flex items-center gap-2.5 cursor-pointer transition-colors"
                  >
                    <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>Xuất PDF (Đầy đủ)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsExportDropdownOpen(false);
                      onExportPDFSignList(sortedEmployees);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-teal-50 hover:text-[#0D9488] flex items-center gap-2.5 cursor-pointer transition-colors"
                  >
                    <ClipboardCheck className="w-4 h-4 text-[#0D9488] shrink-0" />
                    <span>Xuất PDF Danh sách (Ký nhận)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsExportDropdownOpen(false);
                      onExportExcel(sortedEmployees);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-teal-50 hover:text-[#0D9488] flex items-center gap-2.5 cursor-pointer transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Xuất Excel</span>
                  </button>

                  {isAdmin && (
                    <>
                      <div className="my-1 border-t border-slate-100" />
                      <button
                        type="button"
                        onClick={() => {
                          setIsExportDropdownOpen(false);
                          onDownloadTemplate();
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-teal-50 hover:text-[#0D9488] flex items-center gap-2.5 cursor-pointer transition-colors"
                      >
                        <Download className="w-4 h-4 text-sky-600 shrink-0" />
                        <span>Tải file mẫu Excel</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsExportDropdownOpen(false);
                          fileInputRef.current?.click();
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-teal-50 hover:text-[#0D9488] flex items-center gap-2.5 cursor-pointer transition-colors"
                      >
                        <Upload className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>Nhập từ Excel</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {isAdmin && (
              <button
                type="button"
                data-testid="btn-add-employee"
                onClick={onOpenAddEmployee}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold transition-colors shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Thêm nhân sự</span>
              </button>
            )}
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm theo Họ tên, Mã nhân viên, Số CCCD, Số điện thoại hoặc Địa chỉ..."
              aria-label="Tìm kiếm nhân sự"
              className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-[#0D9488] transition-colors"
            />
          </div>

          <div className="w-full lg:w-56 shrink-0">
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              aria-label="Lọc theo Nhóm hoặc Bộ phận"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-[#0D9488] text-slate-700 font-medium cursor-pointer"
            >
              <option value="ALL">Tất cả Nhóm/Bộ phận ({groups.length})</option>
              {groups.map((grp) => (
                <option key={grp.id} value={grp.name}>
                  {grp.name}
                </option>
              ))}
              <option value="__EMPTY__">Chưa phân nhóm (-)</option>
            </select>
          </div>

          <div className="w-full lg:w-60 shrink-0 flex items-center gap-2">
            <select
              value={genderStatusFilter}
              onChange={(e) => setGenderStatusFilter(e.target.value)}
              aria-label="Lọc theo Giới tính hoặc Trạng thái"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-[#0D9488] text-slate-700 font-medium cursor-pointer"
            >
              <option value="ALL">Tất cả Giới tính / Trạng thái</option>
              <optgroup label="Theo Giới tính">
                <option value="Nam">Giới tính: Nam</option>
                <option value="Nữ">Giới tính: Nữ</option>
              </optgroup>
              <optgroup label="Theo Trạng thái làm việc">
                <option value="Đang làm việc">Đang làm việc</option>
                <option value="Tạm nghỉ">Tạm nghỉ</option>
                <option value="Đang thử việc">Đang thử việc</option>
                <option value="Nghỉ thai sản">Nghỉ thai sản</option>
                <option value="Đã nghỉ việc">Đã nghỉ việc</option>
              </optgroup>
            </select>

            {(searchQuery ||
              departmentFilter !== 'ALL' ||
              genderStatusFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setDepartmentFilter('ALL');
                  setGenderStatusFilter('ALL');
                }}
                aria-label="Đặt lại bộ lọc"
                title="Đặt lại bộ lọc"
                className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Nút "↺ Khôi phục sắp xếp mặc định" hiển thị nổi bật ngay trên thanh công cụ lọc khi đang sort bất kỳ cột nào */}
          {sortField !== null && sortDirection !== null && (
            <button
              type="button"
              data-testid="btn-reset-default-sort"
              onClick={() => {
                setSortField(null);
                setSortDirection(null);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-teal-300 bg-teal-50 hover:bg-teal-100 text-[#0F766E] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
            >
              <span>↺ Khôi phục sắp xếp mặc định</span>
            </button>
          )}
        </div>
      </div>

      {/* Compact 9-Column Employee Data Table with Sticky Header & max-h-[calc(100vh-200px)] */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="max-h-[calc(100vh-200px)] overflow-y-auto overflow-x-auto relative">
          <table
            data-testid="employees-table"
            className="w-full text-left border-collapse"
          >
            <thead>
              <tr className="sticky top-0 z-30 bg-[#0F232E] text-white text-[11px] font-semibold tracking-wider uppercase select-none shadow-sm">
                {/* 1. Checkbox chọn */}
                <th className="sticky top-0 z-30 bg-[#0F232E] py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={() =>
                      onToggleSelectAll(sortedEmployees.map((emp) => emp.id))
                    }
                    aria-label="Chọn tất cả nhân sự hiển thị"
                    className="w-3.5 h-3.5 rounded accent-[#0D9488] cursor-pointer"
                  />
                </th>
                {/* 2. STT */}
                <th className="sticky top-0 z-30 bg-[#0F232E] py-3 px-2.5 w-14 text-center">
                  STT
                </th>
                {/* 3. Mã nhân viên (Sortable) */}
                <th
                  data-testid="th-sort-code"
                  onClick={() => handleSortClick('employeeCode')}
                  className="sticky top-0 z-30 bg-[#0F232E] py-3 px-3.5 cursor-pointer hover:bg-slate-800/80 transition-colors group/th whitespace-nowrap"
                >
                  <div className="inline-flex items-center">
                    <span>Mã nhân viên</span>
                    {renderSortIndicator('employeeCode')}
                  </div>
                </th>
                {/* 4. Họ tên (Sortable) */}
                <th
                  data-testid="th-sort-name"
                  onClick={() => handleSortClick('fullName')}
                  className="sticky top-0 z-30 bg-[#0F232E] py-3 px-3.5 cursor-pointer hover:bg-slate-800/80 transition-colors group/th whitespace-nowrap"
                >
                  <div className="inline-flex items-center">
                    <span>Họ tên</span>
                    {renderSortIndicator('fullName')}
                  </div>
                </th>
                {/* 5. Nhóm / Bộ phận (Sortable) */}
                <th
                  data-testid="th-sort-department"
                  onClick={() => handleSortClick('department')}
                  className="sticky top-0 z-30 bg-[#0F232E] py-3 px-3.5 cursor-pointer hover:bg-slate-800/80 transition-colors group/th whitespace-nowrap"
                >
                  <div className="inline-flex items-center">
                    <span>Nhóm / Bộ phận</span>
                    {renderSortIndicator('department')}
                  </div>
                </th>
                {/* 6. Địa chỉ (Sortable - Chỉ hiển thị Xã/Phường, Tỉnh/TP) */}
                <th
                  data-testid="th-sort-address"
                  onClick={() => handleSortClick('address')}
                  className="sticky top-0 z-30 bg-[#0F232E] py-3 px-3.5 cursor-pointer hover:bg-slate-800/80 transition-colors group/th whitespace-nowrap"
                >
                  <div className="inline-flex items-center">
                    <span>Địa chỉ</span>
                    {renderSortIndicator('address')}
                  </div>
                </th>
                {/* 7. Ngày vào (Sortable) */}
                <th
                  data-testid="th-sort-join-date"
                  onClick={() => handleSortClick('joinDate')}
                  className="sticky top-0 z-30 bg-[#0F232E] py-3 px-3 text-center cursor-pointer hover:bg-slate-800/80 transition-colors group/th whitespace-nowrap"
                >
                  <div className="inline-flex items-center justify-center">
                    <span>Ngày vào</span>
                    {renderSortIndicator('joinDate')}
                  </div>
                </th>
                {/* 8. Trạng thái (Sortable) */}
                <th
                  data-testid="th-sort-status"
                  onClick={() => handleSortClick('status')}
                  className="sticky top-0 z-30 bg-[#0F232E] py-3 px-3 text-center cursor-pointer hover:bg-slate-800/80 transition-colors group/th whitespace-nowrap"
                >
                  <div className="inline-flex items-center justify-center">
                    <span>Trạng thái</span>
                    {renderSortIndicator('status')}
                  </div>
                </th>
                {/* 9. Thao tác */}
                <th className="sticky top-0 z-30 bg-[#0F232E] py-3 px-3.5 text-center whitespace-nowrap">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 text-xs">
              {sortedEmployees.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    Không tìm thấy nhân sự nào khớp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                sortedEmployees.map((emp, idx) => {
                  const isSelected = selectedIds.includes(emp.id);
                  const isDrawerOpen = drawerEmployeeId === emp.id;
                  const deptDisplay = (emp.department || '').trim() || '-';
                  const posDisplay = (emp.position || '').trim();
                  const shortAddressDisplay =
                    formatCommuneProvinceAddress(emp.address) || '-';
                  const joinDateDisplay = emp.joinDate
                    ? formatDateVN(emp.joinDate)
                    : '-';

                  return (
                    <tr
                      key={emp.id}
                      onClick={() => setDrawerEmployeeId(emp.id)}
                      className={`transition-colors group cursor-pointer ${
                        isDrawerOpen
                          ? 'bg-teal-50/90'
                          : isSelected
                          ? 'bg-teal-50/60 hover:bg-teal-50'
                          : 'hover:bg-slate-50/90'
                      }`}
                    >
                      {/* 1. Checkbox chọn */}
                      <td
                        className="py-2.5 px-3 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleSelect(emp.id)}
                          aria-label={`Chọn nhân sự ${emp.fullName}`}
                          className="w-3.5 h-3.5 rounded accent-[#0D9488] cursor-pointer"
                        />
                      </td>
                      {/* 2. STT */}
                      <td className="py-2.5 px-2.5 text-center font-mono tabular-nums text-slate-500">
                        {idx + 1}
                      </td>
                      {/* 3. Mã nhân viên */}
                      <td className="py-2.5 px-3.5 font-mono tabular-nums font-bold text-[#0D9488] whitespace-nowrap">
                        {emp.employeeCode || '-'}
                      </td>
                      {/* 4. Họ tên (Chỉ hiển thị Avatar + Họ tên rõ ràng, KHÔNG gộp nhãn Trạng thái; hover gạch chân/đổi màu) */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDrawerEmployeeId(emp.id);
                          }}
                          className="inline-flex items-center gap-2.5 text-left group/name cursor-pointer"
                        >
                          {emp.avatarUrl && (
                            <img
                              src={emp.avatarUrl}
                              alt={emp.fullName}
                              referrerPolicy="no-referrer"
                              className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
                            />
                          )}
                          <span className="font-bold text-slate-900 group-hover/name:text-[#0D9488] group-hover/name:underline transition-colors">
                            {emp.fullName || '-'}
                          </span>
                        </button>
                      </td>
                      {/* 5. Nhóm / Bộ phận (Tên Nhóm kèm dòng phụ nhỏ Chức danh / Vị trí) */}
                      <td
                        className={`py-2.5 px-3.5 whitespace-nowrap ${
                          deptDisplay === '-' && !posDisplay ? 'text-center' : ''
                        }`}
                      >
                        <div
                          className={
                            deptDisplay === '-'
                              ? 'text-slate-400 font-medium'
                              : 'font-semibold text-slate-800'
                          }
                        >
                          {deptDisplay}
                        </div>
                        {posDisplay && (
                          <div className="text-[11px] font-medium text-[#0D9488]">
                            {posDisplay}
                          </div>
                        )}
                      </td>
                      {/* 6. Địa chỉ (Chỉ hiển thị Xã/Phường và Tỉnh/Thành phố gọn trên 1 dòng) */}
                      <td
                        className={`py-2.5 px-3.5 whitespace-nowrap ${
                          shortAddressDisplay === '-'
                            ? 'text-center text-slate-400'
                            : 'text-slate-700 font-medium'
                        }`}
                      >
                        {shortAddressDisplay}
                      </td>
                      {/* 7. Ngày vào */}
                      <td className="py-2.5 px-3 text-center font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {joinDateDisplay}
                      </td>
                      {/* 8. Trạng thái (Tách thành cột riêng biệt: Badge màu xanh/cam/đỏ) */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {renderStatusBadge(emp.status)}
                      </td>
                      {/* 8. Thao tác (3 nút icon gọn đẹp: Xem chi tiết, Sửa, Xóa) */}
                      <td
                        className="py-2.5 px-3.5 text-center whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setDrawerEmployeeId(emp.id)}
                            aria-label={`Xem chi tiết nhân sự ${emp.fullName}`}
                            title="Xem chi tiết hồ sơ"
                            className="p-1.5 rounded-md text-slate-600 hover:text-[#0D9488] hover:bg-teal-50 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => onOpenEditEmployee(emp)}
                                aria-label={`Sửa nhân sự ${emp.fullName}`}
                                title="Sửa thông tin"
                                className="p-1.5 rounded-md text-slate-600 hover:text-[#0D9488] hover:bg-teal-50 transition-colors cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteSingle(emp)}
                                aria-label={`Xóa nhân sự ${emp.fullName}`}
                                title="Xóa nhân sự"
                                className="p-1.5 rounded-md text-[#EF4444] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ngăn kéo Hồ sơ Chi tiết (Slide-over Profile Drawer) */}
      <EmployeeProfileDrawer
        employee={activeDrawerEmployee}
        records={records}
        isAdmin={isAdmin}
        onClose={() => setDrawerEmployeeId(null)}
        onEditEmployee={onOpenEditEmployee}
        onInspectAttachment={onInspectAttachment}
      />
    </div>
  );
};
