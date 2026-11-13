import React, { useEffect, useState } from 'react';
import { X, Upload, Check, Loader2 } from 'lucide-react';
import { DepartmentGroup, Employee, Gender, WorkStatus } from '../types/hr';
import { createAvatarSvgDataUri } from '../data/mockData';
import { uploadImageToHrBucket } from '../utils/supabaseService';

interface EmployeeModalProps {
  isOpen: boolean;
  editingEmployee: Employee | null;
  groups: DepartmentGroup[];
  existingCodes: string[];
  nextSuggestedCode: string;
  onClose: () => void;
  onSave: (employeeData: Omit<Employee, 'id'>, existingId?: string) => void;
}

export const EmployeeModal: React.FC<EmployeeModalProps> = ({
  isOpen,
  editingEmployee,
  groups,
  existingCodes,
  nextSuggestedCode,
  onClose,
  onSave,
}) => {
  const [employeeCode, setEmployeeCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('1996-06-15');
  const [gender, setGender] = useState<Gender>('Nam');
  const [cccd, setCccd] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('Chuyên viên');
  const [standardAnnualLeave, setStandardAnnualLeave] = useState<number>(12);
  const [status, setStatus] = useState<WorkStatus>('Đang làm việc');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    setIsUploadingAvatar(false);
    if (editingEmployee) {
      setEmployeeCode(editingEmployee.employeeCode);
      setFullName(editingEmployee.fullName);
      setDob(editingEmployee.dob);
      setGender(editingEmployee.gender);
      setCccd(editingEmployee.cccd);
      setPhone(editingEmployee.phone);
      setAddress(editingEmployee.address);
      setDepartment(editingEmployee.department);
      setPosition(editingEmployee.position || 'Chuyên viên');
      setStandardAnnualLeave(editingEmployee.standardAnnualLeave);
      setStatus(editingEmployee.status);
      setAvatarUrl(editingEmployee.avatarUrl);
    } else {
      setEmployeeCode(nextSuggestedCode);
      setFullName('');
      setDob('1997-05-15');
      setGender('Nam');
      setCccd('');
      setPhone('');
      setAddress('');
      setDepartment(groups[0]?.name || 'Phòng Kỹ thuật & CNTT');
      setPosition('Chuyên viên');
      setStandardAnnualLeave(12);
      setStatus('Đang làm việc');
      setAvatarUrl('');
    }
  }, [isOpen, editingEmployee, nextSuggestedCode, groups]);

  if (!isOpen) return null;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAvatar(true);
    try {
      const publicUrl = await uploadImageToHrBucket(file, 'avatars');
      setAvatarUrl(publicUrl);
    } catch {
      setErrorMsg('Không thể tải ảnh đại diện lên. Vui lòng thử lại.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const getPreviewAvatar = () => {
    if (avatarUrl) return avatarUrl;
    const parts = fullName.trim().split(' ').filter(Boolean);
    const initials =
      parts.length >= 2
        ? `${parts[parts.length - 2][0]}${parts[parts.length - 1][0]}`.toUpperCase()
        : parts[0]
        ? parts[0].slice(0, 2).toUpperCase()
        : 'NV';
    return createAvatarSvgDataUri(initials, '#0F232E', '#0D9488');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = employeeCode.trim().toUpperCase();
    const cleanName = fullName.trim();

    if (!cleanCode || !cleanName) {
      setErrorMsg('Vui lòng nhập đầy đủ Mã nhân viên và Họ tên.');
      return;
    }

    if (
      !editingEmployee &&
      existingCodes.some((c) => c.toUpperCase() === cleanCode)
    ) {
      setErrorMsg(`Mã nhân viên "${cleanCode}" đã tồn tại trên hệ thống.`);
      return;
    }

    onSave(
      {
        employeeCode: cleanCode,
        fullName: cleanName,
        dob: dob || '1997-01-01',
        gender,
        cccd: cccd.trim() || '001097000000',
        phone: phone.trim() || '0900000000',
        address: address.trim() || 'Hà Nội',
        department: department || groups[0]?.name || 'Phòng Kỹ thuật & CNTT',
        position: position.trim() || 'Chuyên viên',
        joinDate: editingEmployee?.joinDate || new Date().toISOString().slice(0, 10),
        standardAnnualLeave: Number(standardAnnualLeave) >= 0 ? Number(standardAnnualLeave) : 12,
        status,
        avatarUrl: getPreviewAvatar(),
      },
      editingEmployee?.id
    );
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="employee-modal-title"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-2xl overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="bg-[#0F232E] text-white px-5 py-4 flex items-center justify-between">
          <div>
            <h3 id="employee-modal-title" className="text-sm sm:text-base font-bold">
              {editingEmployee
                ? `Cập nhật Hồ sơ Nhân sự (${editingEmployee.employeeCode})`
                : 'Thêm Hồ sơ Nhân sự Mới'}
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Điền đầy đủ thông tin định danh và quỹ phép năm tiêu chuẩn
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-[#FEF2F2] border border-red-200 text-xs font-medium text-[#EF4444]">
              {errorMsg}
            </div>
          )}

          {/* Avatar Preview & Upload Row */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <img
              src={getPreviewAvatar()}
              alt="Xem trước ảnh đại diện"
              referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-full object-cover border-2 border-[#0D9488] shrink-0"
            />
            <div className="space-y-1.5 flex-1">
              <div className="text-xs font-bold text-slate-800">
                Ảnh đại diện nhân sự (Avatar)
              </div>
              <p className="text-[11px] text-slate-500">
                Tải ảnh chân dung hoặc hệ thống tự động tạo Avatar chữ cái theo Họ tên.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer transition-colors">
                  {isUploadingAvatar ? (
                    <Loader2 className="w-3.5 h-3.5 text-[#0D9488] animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5 text-[#0D9488]" />
                  )}
                  <span>
                    {isUploadingAvatar
                      ? 'Đang tải lên Cloud (hr-images)...'
                      : 'Chọn / Chụp ảnh (Lưu Cloud)'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={isUploadingAvatar}
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </label>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl('')}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-red-600 cursor-pointer"
                  >
                    Đặt lại mặc định
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Form Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="emp-code-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Mã nhân viên <span className="text-red-500">*</span>
              </label>
              <input
                id="emp-code-input"
                type="text"
                required
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value)}
                placeholder="VD: NV009"
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488]"
              />
            </div>

            <div>
              <label
                htmlFor="emp-name-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Họ và tên <span className="text-red-500">*</span>
              </label>
              <input
                id="emp-name-input"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="VD: Nguyễn Văn An"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488]"
              />
            </div>

            <div>
              <label
                htmlFor="emp-dob-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Ngày tháng năm sinh
              </label>
              <input
                id="emp-dob-input"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488]"
              />
            </div>

            <div>
              <label
                htmlFor="emp-gender-select"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Giới tính
              </label>
              <select
                id="emp-gender-select"
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488] bg-white"
              >
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
                <option value="Khác">Khác</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="emp-cccd-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Số CCCD / Định danh
              </label>
              <input
                id="emp-cccd-input"
                type="text"
                value={cccd}
                onChange={(e) => setCccd(e.target.value)}
                placeholder="VD: 001097012345"
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488]"
              />
            </div>

            <div>
              <label
                htmlFor="emp-phone-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Số điện thoại
              </label>
              <input
                id="emp-phone-input"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="VD: 0912345678"
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488]"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="emp-address-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Địa chỉ thường trú / Liên hệ
              </label>
              <input
                id="emp-address-input"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="VD: Số 25 Láng Hạ, Đống Đa, Hà Nội"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488]"
              />
            </div>

            <div>
              <label
                htmlFor="emp-dept-select"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Nhóm / Bộ phận
              </label>
              <select
                id="emp-dept-select"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488] bg-white"
              >
                {groups.map((grp) => (
                  <option key={grp.id} value={grp.name}>
                    {grp.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="emp-leave-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Tổng phép năm tiêu chuẩn (Ngày)
              </label>
              <input
                id="emp-leave-input"
                type="number"
                min={0}
                max={30}
                step={0.5}
                value={standardAnnualLeave}
                onChange={(e) => setStandardAnnualLeave(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488]"
              />
            </div>

            <div>
              <label
                htmlFor="emp-status-select"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Trạng thái làm việc
              </label>
              <select
                id="emp-status-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as WorkStatus)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488] bg-white"
              >
                <option value="Đang làm việc">Đang làm việc</option>
                <option value="Đang thử việc">Đang thử việc</option>
                <option value="Nghỉ thai sản">Nghỉ thai sản</option>
                <option value="Đã nghỉ việc">Đã nghỉ việc</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="emp-pos-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Chức danh / Vị trí
              </label>
              <input
                id="emp-pos-input"
                type="text"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="VD: Chuyên viên Nhân sự"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488]"
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{editingEmployee ? 'Lưu cập nhật' : 'Thêm nhân sự'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
