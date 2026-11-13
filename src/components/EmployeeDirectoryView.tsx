import React, { useRef, useState } from 'react';
import {
  FileText,
  FileSpreadsheet,
  Download,
  Upload,
  FolderCog,
  UserPlus,
  Trash2,
  Search,
  Pencil,
  RotateCcw,
} from 'lucide-react';
import { DepartmentGroup, Employee } from '../types/hr';
import { filterEmployees, formatDateVN } from '../utils/hrCalculations';

interface EmployeeDirectoryViewProps {
  employees: Employee[];
  groups: DepartmentGroup[];
  isAdmin?: boolean;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (ids: string[]) => void;
  onDeleteSelected: () => void;
  onDeleteSingle: (emp: Employee) => void;
  onOpenAddEmployee: () => void;
  onOpenEditEmployee: (emp: Employee) => void;
  onOpenManageGroups: () => void;
  onExportPDF: (filteredEmployees: Employee[]) => void;
  onExportExcel: (filteredEmployees: Employee[]) => void;
  onDownloadTemplate: () => void;
  onImportExcelFile: (file: File) => void;
}

export const EmployeeDirectoryView: React.FC<EmployeeDirectoryViewProps> = ({
  employees,
  groups,
  isAdmin = true,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onDeleteSelected,
  onDeleteSingle,
  onOpenAddEmployee,
  onOpenEditEmployee,
  onOpenManageGroups,
  onExportPDF,
  onExportExcel,
  onDownloadTemplate,
  onImportExcelFile,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [genderStatusFilter, setGenderStatusFilter] = useState('ALL');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredEmployees = filterEmployees(
    employees,
    searchQuery,
    departmentFilter,
    genderStatusFilter
  );

  const allFilteredSelected =
    filteredEmployees.length > 0 &&
    filteredEmployees.every((emp) => selectedIds.includes(emp.id));

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

      {/* Action Header Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-4 md:p-5">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          {/* Left: Title + Counter */}
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base md:text-lg font-bold text-slate-900">
                  Quản lý Nhân sự
                </h2>
                <span
                  data-testid="employee-total-counter"
                  className="text-xs font-mono tabular-nums font-bold text-[#0D9488] bg-teal-50 px-2.5 py-0.5 rounded-md"
                >
                  {filteredEmployees.length} / {employees.length} nhân sự
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {isAdmin
                  ? 'Quản lý hồ sơ cá nhân, bộ phận làm việc và định mức phép năm tiêu chuẩn'
                  : 'Chế độ Nhân viên (User): Tra cứu danh bạ nhân sự và định mức phép tiêu chuẩn'}
              </p>
            </div>
          </div>

          {/* Right: Action Buttons Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onExportPDF(filteredEmployees)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-rose-500" />
              <span>Xuất PDF</span>
            </button>

            <button
              type="button"
              onClick={() => onExportExcel(filteredEmployees)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Xuất Excel</span>
            </button>

            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={onDownloadTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-sky-600" />
                  <span>Tải file mẫu Excel</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Nhập từ Excel</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenManageGroups}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <FolderCog className="w-3.5 h-3.5 text-amber-600" />
                  <span>Quản lý Nhóm</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenAddEmployee}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold transition-colors shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Thêm nhân sự</span>
                </button>

                <button
                  type="button"
                  disabled={selectedIds.length === 0}
                  onClick={onDeleteSelected}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    selectedIds.length > 0
                      ? 'border-red-200 bg-[#FEF2F2] text-[#EF4444] hover:bg-red-100 cursor-pointer'
                      : 'border-red-100 bg-[#FEF2F2]/60 text-red-300 cursor-not-allowed'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa đã chọn ({selectedIds.length})</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm theo Họ tên, Mã NV, Số CCCD, Số điện thoại hoặc Địa chỉ..."
              aria-label="Tìm kiếm nhân sự"
              className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-[#0D9488] transition-colors"
            />
          </div>

          <div className="md:col-span-3">
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
            </select>
          </div>

          <div className="md:col-span-3 flex items-center gap-2">
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
                <option value="Đang thử việc">Đang thử việc</option>
                <option value="Nghỉ thai sản">Nghỉ thai sản</option>
                <option value="Đã nghỉ việc">Đã nghỉ việc</option>
              </optgroup>
            </select>

            {(searchQuery || departmentFilter !== 'ALL' || genderStatusFilter !== 'ALL') && (
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
        </div>
      </div>

      {/* Employee Data Table Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-[#0F232E] text-white text-[11px] font-semibold tracking-wider uppercase">
                <th className="py-3 px-2.5 w-9 text-center">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={() =>
                      onToggleSelectAll(filteredEmployees.map((emp) => emp.id))
                    }
                    aria-label="Chọn tất cả nhân sự hiển thị"
                    className="w-3.5 h-3.5 rounded accent-[#0D9488] cursor-pointer"
                  />
                </th>
                <th className="py-3 px-2 w-10 text-center">STT</th>
                <th className="py-3 px-2 w-12 text-center">Ảnh</th>
                <th className="py-3 px-2.5">Mã NV</th>
                <th className="py-3 px-2.5 sticky left-0 z-10 bg-[#0F232E] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                  Họ tên
                </th>
                <th className="py-3 px-2.5">Ngày sinh</th>
                <th className="py-3 px-2 text-center">Giới tính</th>
                <th className="py-3 px-2.5">Số CCCD</th>
                <th className="py-3 px-2.5">Số ĐT</th>
                <th className="py-3 px-2.5">Địa chỉ</th>
                <th className="py-3 px-2.5">Nhóm / Bộ phận</th>
                <th className="py-3 px-2 text-center">Phép năm</th>
                <th className="py-3 px-2.5 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 text-xs">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-500">
                    Không tìm thấy nhân sự nào khớp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp, idx) => {
                  const isSelected = selectedIds.includes(emp.id);
                  return (
                    <tr
                      key={emp.id}
                      className={`transition-colors group ${
                        isSelected
                          ? 'bg-teal-50/60 hover:bg-teal-50'
                          : 'hover:bg-slate-50/90'
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleSelect(emp.id)}
                          aria-label={`Chọn nhân sự ${emp.fullName}`}
                          className="w-3.5 h-3.5 rounded accent-[#0D9488] cursor-pointer"
                        />
                      </td>
                      <td className="py-2.5 px-2.5 text-center font-mono tabular-nums text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <img
                          src={emp.avatarUrl}
                          alt={emp.fullName}
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded-full object-cover mx-auto border border-slate-200"
                        />
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums font-bold text-[#0D9488] whitespace-nowrap">
                        {emp.employeeCode}
                      </td>
                      <td
                        className={`py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] ${
                          isSelected
                            ? 'bg-teal-50 group-hover:bg-teal-50'
                            : 'bg-white group-hover:bg-slate-50'
                        }`}
                      >
                        <div>{emp.fullName}</div>
                        <div className="text-[11px] font-normal text-slate-400">
                          {emp.status}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {formatDateVN(emp.dob)}
                      </td>
                      <td className="py-2.5 px-2.5 text-center text-slate-700 whitespace-nowrap">
                        {emp.gender}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {emp.cccd}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {emp.phone}
                      </td>
                      <td
                        className="py-2.5 px-3 text-slate-600 max-w-[220px] truncate"
                        title={emp.address}
                      >
                        {emp.address}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800 whitespace-nowrap">
                        {emp.department}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono tabular-nums font-bold text-slate-900">
                        {emp.standardAnnualLeave} ngày
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {isAdmin ? (
                          <div className="inline-flex items-center gap-1">
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
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">Chỉ xem</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
