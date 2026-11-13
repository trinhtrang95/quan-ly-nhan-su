import React, { useEffect, useState } from 'react';
import { X, Upload, Check, Loader2, MapPin } from 'lucide-react';
import {
  DepartmentGroup,
  Employee,
  Gender,
  PositionItem,
  WorkStatus,
} from '../types/hr';
import { createAvatarSvgDataUri, INITIAL_POSITIONS } from '../data/mockData';
import { uploadImageToHrBucket } from '../utils/supabaseService';
import {
  composeAddressFromParts,
  fetchCommunesForProvince,
  parseAddressIntoParts,
  VN_28_PROVINCES,
  VN_6_CENTRAL_CITIES,
} from '../utils/vnAddressData';

interface EmployeeModalProps {
  isOpen: boolean;
  editingEmployee: Employee | null;
  groups: DepartmentGroup[];
  positions: PositionItem[];
  existingCodes: string[];
  nextSuggestedCode: string;
  defaultAnnualLeaveQuota?: number;
  onClose: () => void;
  onSave: (employeeData: Omit<Employee, 'id'>, existingId?: string) => void;
}

export const EmployeeModal: React.FC<EmployeeModalProps> = ({
  isOpen,
  editingEmployee,
  groups,
  positions,
  existingCodes,
  nextSuggestedCode,
  defaultAnnualLeaveQuota = 12,
  onClose,
  onSave,
}) => {
  const effectivePositions =
    positions && positions.length > 0 ? positions : INITIAL_POSITIONS;

  const [employeeCode, setEmployeeCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<Gender>('');
  const [cccd, setCccd] = useState('');
  const [cccdDate, setCccdDate] = useState('');
  const [phone, setPhone] = useState('');

  // Bộ chọn địa chỉ hành chính 2 cấp sau sáp nhập (Tỉnh/TP -> Xã/Phường -> Địa chỉ chi tiết)
  const [addressProvince, setAddressProvince] = useState('');
  const [addressCommune, setAddressCommune] = useState('');
  const [addressDetail, setAddressDetail] = useState('');
  const [communeSuggestions, setCommuneSuggestions] = useState<string[]>([]);

  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  const [joinDate, setJoinDate] = useState('');
  const [standardAnnualLeave, setStandardAnnualLeave] = useState<number>(
    defaultAnnualLeaveQuota
  );
  const [status, setStatus] = useState<WorkStatus>('Đang làm việc');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    setIsUploadingAvatar(false);

    if (editingEmployee) {
      const validDept =
        editingEmployee.department &&
        groups.some((g) => g.name === editingEmployee.department)
          ? editingEmployee.department
          : '';

      const parsedAddr = parseAddressIntoParts(editingEmployee.address);

      setEmployeeCode(editingEmployee.employeeCode);
      setFullName(editingEmployee.fullName);
      setDob(editingEmployee.dob || '');
      setGender(editingEmployee.gender || '');
      setCccd(editingEmployee.cccd || '');
      setCccdDate(editingEmployee.cccdDate || '');
      setPhone(editingEmployee.phone || '');
      setAddressProvince(parsedAddr.province);
      setAddressCommune(parsedAddr.commune);
      setAddressDetail(parsedAddr.detail);
      setDepartment(validDept);
      setPosition(editingEmployee.position || '');
      setJoinDate(editingEmployee.joinDate || '');
      setStandardAnnualLeave(editingEmployee.standardAnnualLeave);
      setStatus(editingEmployee.status);
      setAvatarUrl(editingEmployee.avatarUrl || '');
    } else {
      setEmployeeCode(nextSuggestedCode);
      setFullName('');
      setDob('');
      setGender('');
      setCccd('');
      setCccdDate('');
      setPhone('');
      setAddressProvince('');
      setAddressCommune('');
      setAddressDetail('');
      setDepartment('');
      setPosition('');
      setJoinDate('');
      setStandardAnnualLeave(defaultAnnualLeaveQuota);
      setStatus('Đang làm việc');
      setAvatarUrl('');
    }
  }, [
    isOpen,
    editingEmployee,
    nextSuggestedCode,
    groups,
    defaultAnnualLeaveQuota,
  ]);

  // Nạp danh sách Xã/Phường gợi ý khi chọn Tỉnh/Thành phố
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    if (!addressProvince) {
      setCommuneSuggestions([]);
      return;
    }
    fetchCommunesForProvince(addressProvince).then((list) => {
      if (active) {
        setCommuneSuggestions(list);
      }
    });
    return () => {
      active = false;
    };
  }, [isOpen, addressProvince]);

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

  const composedAddressPreview = composeAddressFromParts(
    addressDetail,
    addressCommune,
    addressProvince
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = employeeCode.trim().toUpperCase();
    const cleanName = fullName.trim();

    if (!cleanCode || !cleanName) {
      setErrorMsg('Vui lòng nhập đầy đủ 2 trường bắt buộc: Mã nhân viên và Họ tên.');
      return;
    }

    // Enforce unique Mã nhân viên across both Add and Edit
    const isDuplicateCode = existingCodes.some(
      (c) => c.trim().toUpperCase() === cleanCode
    );
    if (isDuplicateCode) {
      setErrorMsg(
        `Mã nhân viên "${cleanCode}" đã tồn tại trong bảng! Mỗi Mã nhân viên chỉ được xuất hiện 1 lần duy nhất.`
      );
      return;
    }

    // Ensure department is strictly in registered groups or empty string ""
    const validatedDepartment =
      department && groups.some((g) => g.name === department)
        ? department
        : '';

    const finalAddress = composeAddressFromParts(
      addressDetail,
      addressCommune,
      addressProvince
    );

    onSave(
      {
        employeeCode: cleanCode,
        fullName: cleanName,
        dob: dob.trim(),
        gender,
        cccd: cccd.trim(),
        cccdDate: cccdDate.trim(),
        phone: phone.trim(),
        address: finalAddress,
        department: validatedDepartment,
        position: position.trim(),
        joinDate: joinDate.trim(),
        standardAnnualLeave:
          Number(standardAnnualLeave) >= 0 ? Number(standardAnnualLeave) : 12,
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
              Chỉ bắt buộc nhập Mã nhân viên và Họ tên (*). Các trường còn lại có thể để trống (-).
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
            <div
              role="alert"
              data-testid="employee-modal-error"
              className="p-3 rounded-lg bg-[#FEF2F2] border border-red-200 text-xs font-medium text-[#EF4444]"
            >
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
                Ảnh đại diện nhân sự (Không bắt buộc)
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
                placeholder="VD: NV001"
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
                Ngày sinh
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
                <option value="">-- Để trống (-) --</option>
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
                placeholder="Để trống sẽ hiển thị -"
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488]"
              />
            </div>

            <div>
              <label
                htmlFor="emp-cccd-date-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Ngày cấp CCCD
              </label>
              <input
                id="emp-cccd-date-input"
                type="date"
                value={cccdDate}
                onChange={(e) => setCccdDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488]"
              />
            </div>

            {/* Bộ chọn Địa chỉ Hành chính 2 cấp sau sáp nhập (Tỉnh/TP -> Xã/Phường -> Địa chỉ chi tiết) */}
            <div className="sm:col-span-2 p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <MapPin className="w-3.5 h-3.5 text-[#0D9488]" />
                  <span>Địa chỉ thường trú (Hành chính 2 cấp sau sáp nhập)</span>
                </div>
                {composedAddressPreview && (
                  <span
                    data-testid="address-composed-preview"
                    className="text-[11px] font-medium text-[#0D9488] truncate max-w-[320px]"
                    title={composedAddressPreview}
                  >
                    {composedAddressPreview}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Tỉnh / Thành phố (34 Tỉnh/TP sau sáp nhập) */}
                <div>
                  <label
                    htmlFor="emp-addr-province"
                    className="block text-[11px] font-semibold text-slate-600 mb-1"
                  >
                    1. Tỉnh / Thành phố
                  </label>
                  <select
                    id="emp-addr-province"
                    value={addressProvince}
                    onChange={(e) => setAddressProvince(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488] bg-white"
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

                {/* 2. Xã / Phường / Đặc khu (Input kết hợp datalist gợi ý thông minh) */}
                <div>
                  <label
                    htmlFor="emp-addr-commune"
                    className="block text-[11px] font-semibold text-slate-600 mb-1"
                  >
                    2. Xã / Phường / Đặc khu
                  </label>
                  <input
                    id="emp-addr-commune"
                    type="text"
                    list="vn-commune-datalist"
                    value={addressCommune}
                    onChange={(e) => setAddressCommune(e.target.value)}
                    placeholder={
                      addressProvince
                        ? `Chọn hoặc gõ Xã/Phường (${addressProvince})...`
                        : 'Chọn hoặc gõ Xã/Phường...'
                    }
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488] bg-white"
                  />
                  <datalist id="vn-commune-datalist">
                    {communeSuggestions.map((comm) => (
                      <option key={comm} value={comm} />
                    ))}
                  </datalist>
                </div>

                {/* 3. Địa chỉ chi tiết (Thôn/Xóm/Số nhà/Đường) */}
                <div>
                  <label
                    htmlFor="emp-addr-detail"
                    className="block text-[11px] font-semibold text-slate-600 mb-1"
                  >
                    3. Địa chỉ chi tiết
                  </label>
                  <input
                    id="emp-addr-detail"
                    type="text"
                    value={addressDetail}
                    onChange={(e) => setAddressDetail(e.target.value)}
                    placeholder="Thôn / Xóm / Số nhà / Đường..."
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488] bg-white"
                  />
                </div>
              </div>
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
                <option value="">-- Để trống (-) --</option>
                {groups.map((grp) => (
                  <option key={grp.id} value={grp.name}>
                    {grp.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="emp-pos-select"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Chức danh / Vị trí
              </label>
              <select
                id="emp-pos-select"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488] bg-white"
              >
                <option value="">-- Để trống (-) --</option>
                {position &&
                  !effectivePositions.some((p) => p.name === position) && (
                    <option value={position}>{position}</option>
                  )}
                {effectivePositions.map((pos) => (
                  <option key={pos.id} value={pos.name}>
                    {pos.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="emp-join-date-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Ngày vào
              </label>
              <input
                id="emp-join-date-input"
                type="date"
                value={joinDate}
                onChange={(e) => setJoinDate(e.target.value)}
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
                placeholder="Để trống sẽ hiển thị -"
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488]"
              />
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
                <option value="Tạm nghỉ">Tạm nghỉ</option>
                <option value="Đang thử việc">Đang thử việc</option>
                <option value="Nghỉ thai sản">Nghỉ thai sản</option>
                <option value="Đã nghỉ việc">Đã nghỉ việc</option>
              </select>
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
