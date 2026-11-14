import React, { useEffect, useRef, useState } from 'react';
import { X, Upload, Check, Loader2, ChevronDown } from 'lucide-react';
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
  ALL_COMMUNES_SUGGESTIONS,
  ALL_PROVINCE_OPTIONS,
  composeAddressFromParts,
  fetchCommunesForProvince,
  parseAddressIntoParts,
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
  const [familyInfo, setFamilyInfo] = useState('');

  // Bộ chọn địa chỉ hành chính 2 cấp sau sáp nhập (Tỉnh/TP -> Xã/Phường -> Địa chỉ chi tiết)
  const [addressProvince, setAddressProvince] = useState('');
  const [addressCommune, setAddressCommune] = useState('');
  const [addressDetail, setAddressDetail] = useState('');
  const [communeSuggestions, setCommuneSuggestions] = useState<string[]>(
    ALL_COMMUNES_SUGGESTIONS
  );
  const [isProvinceDropdownOpen, setIsProvinceDropdownOpen] = useState(false);
  const [isCommuneDropdownOpen, setIsCommuneDropdownOpen] = useState(false);
  const provinceWrapperRef = useRef<HTMLDivElement>(null);
  const communeWrapperRef = useRef<HTMLDivElement>(null);

  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  const [joinDate, setJoinDate] = useState('');
  const [status, setStatus] = useState<WorkStatus>('Đang làm việc');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        provinceWrapperRef.current &&
        !provinceWrapperRef.current.contains(e.target as Node)
      ) {
        setIsProvinceDropdownOpen(false);
      }
      if (
        communeWrapperRef.current &&
        !communeWrapperRef.current.contains(e.target as Node)
      ) {
        setIsCommuneDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    setIsUploadingAvatar(false);
    setIsProvinceDropdownOpen(false);
    setIsCommuneDropdownOpen(false);

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
      setFamilyInfo(editingEmployee.familyInfo || '');
      setAddressProvince(parsedAddr.province);
      setAddressCommune(parsedAddr.commune);
      setAddressDetail(parsedAddr.detail);
      setDepartment(validDept);
      setPosition(editingEmployee.position || '');
      setJoinDate(editingEmployee.joinDate || '');
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
      setFamilyInfo('');
      setAddressProvince('');
      setAddressCommune('');
      setAddressDetail('');
      setDepartment('');
      setPosition('');
      setJoinDate('');
      setStatus('Đang làm việc');
      setAvatarUrl('');
    }
  }, [isOpen, editingEmployee, nextSuggestedCode, groups]);

  // Nạp danh sách Xã/Phường gợi ý khi chọn hoặc gõ Tỉnh/Thành phố
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
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

  const filteredProvinceSuggestions = ALL_PROVINCE_OPTIONS.filter((prov) => {
    const q = addressProvince.trim().toLowerCase();
    if (!q) return true;
    if (ALL_PROVINCE_OPTIONS.some((p) => p.toLowerCase() === q)) return true;
    return prov.toLowerCase().includes(q);
  });

  const filteredCommuneSuggestions = (() => {
    const q = addressCommune.trim().toLowerCase();
    if (!q) return communeSuggestions.slice(0, 80);
    if (communeSuggestions.some((c) => c.toLowerCase() === q)) {
      return communeSuggestions.slice(0, 80);
    }
    const inProvince = communeSuggestions.filter((item) =>
      item.toLowerCase().includes(q)
    );
    if (inProvince.length > 0) return inProvince.slice(0, 60);
    return ALL_COMMUNES_SUGGESTIONS.filter((item) =>
      item.toLowerCase().includes(q)
    ).slice(0, 60);
  })();

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

    const preservedAnnualLeave =
      editingEmployee?.standardAnnualLeave !== undefined
        ? editingEmployee.standardAnnualLeave
        : defaultAnnualLeaveQuota;

    onSave(
      {
        employeeCode: cleanCode,
        fullName: cleanName,
        dob: dob.trim(),
        gender,
        cccd: cccd.trim(),
        cccdDate: cccdDate.trim(),
        phone: phone.trim(),
        familyInfo: familyInfo.trim(),
        address: finalAddress,
        department: validatedDepartment,
        position: position.trim(),
        joinDate: joinDate.trim(),
        standardAnnualLeave: preservedAnnualLeave,
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
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
    >
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-visible">
        {/* Modal Header (Compact, không có dòng chú thích thừa) */}
        <div className="bg-[#0F232E] text-white px-5 py-3 rounded-t-xl flex items-center justify-between shrink-0">
          <h3 id="employee-modal-title" className="text-sm sm:text-base font-bold">
            {editingEmployee
              ? `Cập nhật Hồ sơ Nhân sự (${editingEmployee.employeeCode})`
              : 'Thêm Hồ sơ Nhân sự Mới'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body Compact 5-Row Layout (Vừa khít 1 màn hình, không cần cuộn) */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto">
          {errorMsg && (
            <div
              role="alert"
              data-testid="employee-modal-error"
              className="px-3 py-2 rounded-lg bg-[#FEF2F2] border border-red-200 text-xs font-medium text-[#EF4444]"
            >
              {errorMsg}
            </div>
          )}

          {/* HÀNG 1: Ảnh đại diện (gọn bên trái) + Mã nhân viên + Họ và tên (in đậm) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <div className="md:col-span-3 flex items-center gap-2.5">
              <img
                src={getPreviewAvatar()}
                alt="Ảnh đại diện"
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-full object-cover border-2 border-[#0D9488] shrink-0"
              />
              <div className="min-w-0 flex flex-col gap-1">
                <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer transition-colors whitespace-nowrap">
                  {isUploadingAvatar ? (
                    <Loader2 className="w-3 h-3 text-[#0D9488] animate-spin" />
                  ) : (
                    <Upload className="w-3 h-3 text-[#0D9488]" />
                  )}
                  <span>{isUploadingAvatar ? 'Đang tải...' : 'Chọn ảnh'}</span>
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
                    className="text-[10px] font-medium text-slate-500 hover:text-red-600 text-left cursor-pointer"
                  >
                    Đặt lại mặc định
                  </button>
                )}
              </div>
            </div>

            <div className="md:col-span-3">
              <label
                htmlFor="emp-code-input"
                className="block text-[11px] font-semibold text-slate-700 mb-1"
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
                className="w-full px-2.5 py-1.5 text-xs font-mono font-bold text-[#0D9488] rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#0D9488]"
              />
            </div>

            <div className="md:col-span-6">
              <label
                htmlFor="emp-name-input"
                className="block text-[11px] font-bold text-slate-900 mb-1"
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
                className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-900 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#0D9488]"
              />
            </div>
          </div>

          {/* HÀNG 2: Ngày sinh + Giới tính + Số CCCD + Ngày cấp CCCD */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label
                htmlFor="emp-dob-input"
                className="block text-[11px] font-semibold text-slate-700 mb-1"
              >
                Ngày sinh
              </label>
              <input
                id="emp-dob-input"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488]"
              />
            </div>

            <div>
              <label
                htmlFor="emp-gender-select"
                className="block text-[11px] font-semibold text-slate-700 mb-1"
              >
                Giới tính
              </label>
              <select
                id="emp-gender-select"
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488] bg-white"
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
                className="block text-[11px] font-semibold text-slate-700 mb-1"
              >
                Số CCCD
              </label>
              <input
                id="emp-cccd-input"
                type="text"
                value={cccd}
                onChange={(e) => setCccd(e.target.value)}
                placeholder="Nhập số CCCD..."
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488]"
              />
            </div>

            <div>
              <label
                htmlFor="emp-cccd-date-input"
                className="block text-[11px] font-semibold text-slate-700 mb-1"
              >
                Ngày cấp CCCD
              </label>
              <input
                id="emp-cccd-date-input"
                type="date"
                value={cccdDate}
                onChange={(e) => setCccdDate(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488]"
              />
            </div>
          </div>

          {/* HÀNG 3: Tỉnh / Thành phố + Xã / Phường / Thị trấn + Địa chỉ chi tiết (Thôn/Xóm/Số nhà) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Tỉnh / Thành phố (Combobox + Datalist: vừa chọn nhanh vừa gõ tự do) */}
            <div className="relative" ref={provinceWrapperRef}>
              <label
                htmlFor="emp-addr-province"
                className="block text-[11px] font-semibold text-slate-700 mb-1"
              >
                Tỉnh / Thành phố
              </label>
              <div className="relative">
                <input
                  id="emp-addr-province"
                  type="text"
                  list="vn-province-datalist"
                  value={addressProvince}
                  onFocus={() => setIsProvinceDropdownOpen(true)}
                  onChange={(e) => {
                    setAddressProvince(e.target.value);
                    setIsProvinceDropdownOpen(true);
                  }}
                  placeholder="Chọn hoặc gõ Tỉnh/Thành phố..."
                  className="w-full pl-2.5 pr-7 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488] bg-white"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Mở danh sách Tỉnh Thành phố"
                  onClick={() => setIsProvinceDropdownOpen((prev) => !prev)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              <datalist id="vn-province-datalist">
                {ALL_PROVINCE_OPTIONS.map((prov) => (
                  <option key={prov} value={prov} />
                ))}
              </datalist>

              {isProvinceDropdownOpen &&
                filteredProvinceSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 max-h-44 overflow-y-auto bg-white rounded-lg border border-slate-200 shadow-xl z-50 py-1 text-xs">
                    {filteredProvinceSuggestions.map((prov) => (
                      <button
                        key={prov}
                        type="button"
                        onClick={() => {
                          setAddressProvince(prov);
                          setIsProvinceDropdownOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 hover:bg-teal-50 hover:text-[#0D9488] transition-colors cursor-pointer ${
                          addressProvince === prov
                            ? 'bg-teal-50/70 font-semibold text-[#0D9488]'
                            : 'text-slate-700'
                        }`}
                      >
                        {prov}
                      </button>
                    ))}
                  </div>
                )}
            </div>

            {/* Xã / Phường / Thị trấn (Combobox + Datalist: vừa chọn nhanh từ gợi ý vừa gõ tự do 100%) */}
            <div className="relative" ref={communeWrapperRef}>
              <label
                htmlFor="emp-addr-commune"
                className="block text-[11px] font-semibold text-slate-700 mb-1"
              >
                Xã / Phường / Thị trấn
              </label>
              <div className="relative">
                <input
                  id="emp-addr-commune"
                  type="text"
                  list="vn-commune-datalist"
                  value={addressCommune}
                  onFocus={() => setIsCommuneDropdownOpen(true)}
                  onChange={(e) => {
                    setAddressCommune(e.target.value);
                    setIsCommuneDropdownOpen(true);
                  }}
                  placeholder={
                    addressProvince
                      ? `Chọn hoặc gõ Xã/Phường (${addressProvince})...`
                      : 'Chọn hoặc gõ Xã/Phường bất kỳ...'
                  }
                  className="w-full pl-2.5 pr-7 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488] bg-white"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Mở danh sách Xã Phường"
                  onClick={() => setIsCommuneDropdownOpen((prev) => !prev)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              <datalist id="vn-commune-datalist">
                {communeSuggestions.map((comm) => (
                  <option key={comm} value={comm} />
                ))}
              </datalist>

              {isCommuneDropdownOpen &&
                filteredCommuneSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 max-h-44 overflow-y-auto bg-white rounded-lg border border-slate-200 shadow-xl z-50 py-1 text-xs">
                    {filteredCommuneSuggestions.map((comm) => (
                      <button
                        key={comm}
                        type="button"
                        onClick={() => {
                          setAddressCommune(comm);
                          setIsCommuneDropdownOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 hover:bg-teal-50 hover:text-[#0D9488] transition-colors cursor-pointer ${
                          addressCommune === comm
                            ? 'bg-teal-50/70 font-semibold text-[#0D9488]'
                            : 'text-slate-700'
                        }`}
                      >
                        {comm}
                      </button>
                    ))}
                  </div>
                )}
            </div>

            {/* Địa chỉ chi tiết (Thôn/Xóm/Số nhà) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="emp-addr-detail"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Địa chỉ chi tiết (Thôn/Xóm/Số nhà)
                </label>
                {composedAddressPreview && (
                  <span
                    data-testid="address-composed-preview"
                    className="text-[10px] font-medium text-[#0D9488] truncate max-w-[120px]"
                    title={composedAddressPreview}
                  >
                    {composedAddressPreview}
                  </span>
                )}
              </div>
              <input
                id="emp-addr-detail"
                type="text"
                value={addressDetail}
                onChange={(e) => setAddressDetail(e.target.value)}
                placeholder="Thôn / Xóm / Số nhà / Đường..."
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488]"
              />
            </div>
          </div>

          {/* HÀNG 4: Số điện thoại + Thông tin người nhà */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="emp-phone-input"
                className="block text-[11px] font-semibold text-slate-700 mb-1"
              >
                Số điện thoại
              </label>
              <input
                id="emp-phone-input"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Nhập số điện thoại..."
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488]"
              />
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="emp-family-info-input"
                className="block text-[11px] font-semibold text-slate-700 mb-1"
              >
                Thông tin người nhà
              </label>
              <input
                id="emp-family-info-input"
                type="text"
                value={familyInfo}
                onChange={(e) => setFamilyInfo(e.target.value)}
                placeholder="VD: Nguyễn Thị B (Vợ) - SĐT: 0912345678..."
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488]"
              />
            </div>
          </div>

          {/* HÀNG 5: Nhóm / Bộ phận + Chức vụ + Ngày vào công ty + Trạng thái làm việc */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label
                htmlFor="emp-dept-select"
                className="block text-[11px] font-semibold text-slate-700 mb-1"
              >
                Nhóm / Bộ phận
              </label>
              <select
                id="emp-dept-select"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488] bg-white"
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
                className="block text-[11px] font-semibold text-slate-700 mb-1"
              >
                Chức vụ
              </label>
              <select
                id="emp-pos-select"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488] bg-white"
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
                className="block text-[11px] font-semibold text-slate-700 mb-1"
              >
                Ngày vào công ty
              </label>
              <input
                id="emp-join-date-input"
                type="date"
                value={joinDate}
                onChange={(e) => setJoinDate(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488]"
              />
            </div>

            <div>
              <label
                htmlFor="emp-status-select"
                className="block text-[11px] font-semibold text-slate-700 mb-1"
              >
                Trạng thái làm việc
              </label>
              <select
                id="emp-status-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as WorkStatus)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488] bg-white"
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
          <div className="pt-2.5 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{editingEmployee ? 'Lưu thay đổi' : 'Thêm nhân sự'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
