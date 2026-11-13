/**
 * Danh sách chuẩn 34 Tỉnh / Thành phố sau sáp nhập của Việt Nam
 * và bộ xử lý tách/ghép địa chỉ hành chính 2 cấp (Tỉnh/TP -> Xã/Phường -> Địa chỉ chi tiết)
 */

export const VN_34_PROVINCES: string[] = [
  'Hà Nội',
  'TP. Hồ Chí Minh',
  'Hải Phòng',
  'Đà Nẵng',
  'Cần Thơ',
  'Huế',
  'Đồng Nai',
  'Quảng Ninh',
  'Bắc Ninh',
  'Phú Thọ',
  'Hưng Yên',
  'Ninh Bình',
  'Thanh Hóa',
  'Nghệ An',
  'Hà Tĩnh',
  'Quảng Trị',
  'Quảng Ngãi',
  'Gia Lai',
  'Khánh Hòa',
  'Đắk Lắk',
  'Lâm Đồng',
  'Tây Ninh',
  'Đồng Tháp',
  'Vĩnh Long',
  'An Giang',
  'Cà Mau',
  'Cao Bằng',
  'Tuyên Quang',
  'Điện Biên',
  'Lai Châu',
  'Sơn La',
  'Lào Cai',
  'Thái Nguyên',
  'Lạng Sơn',
];

/**
 * Danh sách Xã / Phường / Đặc khu chuẩn sau sáp nhập theo từng Tỉnh/Thành phố (34 Tỉnh/TP)
 */
export const DEFAULT_COMMUNES_BY_PROVINCE: Record<string, string[]> = {
  'Phú Thọ': [
    'Xã Lương Sơn',
    'Phường Hòa Bình',
    'Phường Kỳ Sơn',
    'Phường Tân Hòa',
    'Phường Thống Nhất',
    'Phường Việt Trì',
    'Phường Âu Cơ',
    'Phường Vĩnh Yên',
    'Phường Phúc Yên',
    'Xã Đà Bắc',
    'Xã Kim Bôi',
    'Xã Lạc Thủy',
    'Xã Yên Thủy',
    'Xã Mai Châu',
    'Xã Tân Lạc',
    'Xã Cao Phong',
    'Xã Lạc Sơn',
    'Xã Thanh Sơn',
    'Xã Hạ Hòa',
    'Xã Cẩm Khê',
    'Xã Phù Ninh',
    'Xã Lâm Thao',
    'Xã Tam Đảo',
    'Xã Bình Xuyên',
  ],
  'Hà Nội': [
    'Phường Ba Đình',
    'Phường Hoàn Kiếm',
    'Phường Đống Đa',
    'Phường Hai Bà Trưng',
    'Phường Cầu Giấy',
    'Phường Thanh Xuân',
    'Phường Tây Hồ',
    'Phường Long Biên',
    'Phường Hà Đông',
    'Phường Nam Từ Liêm',
    'Phường Bắc Từ Liêm',
    'Phường Hoàng Mai',
    'Phường Sơn Tây',
    'Xã Đông Anh',
    'Xã Gia Lâm',
    'Xã Thanh Trì',
    'Xã Sóc Sơn',
    'Xã Hoài Đức',
    'Xã Chương Mỹ',
    'Xã Quốc Oai',
    'Xã Thạch Thất',
    'Xã Mỹ Đức',
    'Xã Ứng Hòa',
  ],
  'TP. Hồ Chí Minh': [
    'Phường Sài Gòn',
    'Phường Tân Định',
    'Phường Bến Thành',
    'Phường Chợ Lớn',
    'Phường Gia Định',
    'Phường Thủ Đức',
    'Phường Thảo Điền',
    'Phường Phú Mỹ Hưng',
    'Phường Tân Bình',
    'Phường Gò Vấp',
    'Phường Phú Nhuận',
    'Phường Bình Thạnh',
    'Phường Thủ Dầu Một',
    'Phường Dĩ An',
    'Phường Thuận An',
    'Phường Vũng Tàu',
    'Phường Bà Rịa',
    'Xã Củ Chi',
    'Xã Hóc Môn',
    'Xã Bình Chánh',
    'Xã Nhà Bè',
    'Đặc khu Côn Đảo',
  ],
  'Hải Phòng': [
    'Phường Hồng Bàng',
    'Phường Ngô Quyền',
    'Phường Lê Chân',
    'Phường Hải An',
    'Phường Kiến An',
    'Phường Đồ Sơn',
    'Phường Dương Kinh',
    'Phường Thủy Nguyên',
    'Phường Hải Dương',
    'Phường Chí Linh',
    'Xã An Dương',
    'Xã An Lão',
    'Xã Kiến Thụy',
    'Xã Tiên Lãng',
    'Xã Vĩnh Bảo',
    'Đặc khu Bạch Long Vĩ',
    'Đặc khu Cát Hải',
  ],
  'Đà Nẵng': [
    'Phường Hải Châu',
    'Phường Thanh Khê',
    'Phường Sơn Trà',
    'Phường Ngũ Hành Sơn',
    'Phường Liên Chiểu',
    'Phường Cẩm Lệ',
    'Phường Tam Kỳ',
    'Phường Hội An',
    'Xã Hòa Vang',
    'Xã Điện Bàn',
    'Xã Đại Lộc',
    'Xã Duy Xuyên',
    'Xã Thăng Bình',
    'Xã Núi Thành',
    'Đặc khu Hoàng Sa',
  ],
  'Cần Thơ': [
    'Phường Ninh Kiều',
    'Phường Cái Răng',
    'Phường Bình Thủy',
    'Phường Ô Môn',
    'Phường Thốt Nốt',
    'Phường Sóc Trăng',
    'Phường Vị Thanh',
    'Phường Ngã Bảy',
    'Xã Phong Điền',
    'Xã Cờ Đỏ',
    'Xã Vĩnh Thạnh',
    'Xã Thới Lai',
  ],
  'Huế': [
    'Phường Thuận Hóa',
    'Phường Phú Xuân',
    'Phường Hương Thủy',
    'Phường Hương Trà',
    'Phường Phong Điền',
    'Xã Phú Vang',
    'Xã Quảng Điền',
    'Xã Phú Lộc',
    'Xã A Lưới',
  ],
  'Đồng Nai': [
    'Phường Biên Hòa',
    'Phường Trấn Biên',
    'Phường Long Khánh',
    'Phường Đồng Xoài',
    'Phường Phước Long',
    'Phường Bình Long',
    'Xã Long Thành',
    'Xã Nhơn Trạch',
    'Xã Trảng Bom',
    'Xã Vĩnh Cửu',
    'Xã Xuân Lộc',
  ],
  'Quảng Ninh': [
    'Phường Hạ Long',
    'Phường Bãi Cháy',
    'Phường Hồng Gai',
    'Phường Cẩm Phả',
    'Phường Uông Bí',
    'Phường Móng Cái',
    'Phường Đông Triều',
    'Phường Quảng Yên',
    'Xã Tiên Yên',
    'Xã Đầm Hà',
    'Xã Hải Hà',
    'Đặc khu Vân Đồn',
    'Đặc khu Cô Tô',
  ],
  'Bắc Ninh': [
    'Phường Kinh Bắc',
    'Phường Suối Hoa',
    'Phường Võ Cường',
    'Phường Từ Sơn',
    'Phường Quế Võ',
    'Phường Thuận Thành',
    'Phường Bắc Giang',
    'Phường Việt Yên',
    'Xã Yên Phong',
    'Xã Tiên Du',
    'Xã Gia Bình',
    'Xã Lương Tài',
    'Xã Hiệp Hòa',
    'Xã Lục Ngạn',
  ],
  'Hưng Yên': [
    'Phường Lam Sơn',
    'Phường Hiến Nam',
    'Phường Mỹ Hào',
    'Phường Thái Bình',
    'Xã Văn Giang',
    'Xã Văn Lâm',
    'Xã Yên Mỹ',
    'Xã Khoái Châu',
    'Xã Kim Động',
    'Xã Ân Thi',
    'Xã Tiên Lữ',
    'Xã Phù Cừ',
  ],
  'Ninh Bình': [
    'Phường Hoa Lư',
    'Phường Tam Điệp',
    'Phường Nam Định',
    'Phường Phủ Lý',
    'Phường Duy Tiên',
    'Xã Gia Viễn',
    'Xã Nho Quan',
    'Xã Yên Khánh',
    'Xã Yên Mô',
    'Xã Kim Sơn',
  ],
  'Thanh Hóa': [
    'Phường Hạc Thành',
    'Phường Đông Hương',
    'Phường Sầm Sơn',
    'Phường Bỉm Sơn',
    'Phường Nghi Sơn',
    'Xã Quảng Xương',
    'Xã Hoằng Hóa',
    'Xã Hậu Lộc',
    'Xã Nga Sơn',
    'Xã Thọ Xuân',
  ],
  'Nghệ An': [
    'Phường Trường Thi',
    'Phường Hưng Dũng',
    'Phường Cửa Lò',
    'Phường Hoàng Mai',
    'Phường Thái Hòa',
    'Xã Nghi Lộc',
    'Xã Diễn Châu',
    'Xã Quỳnh Lưu',
    'Xã Yên Thành',
    'Xã Đô Lương',
  ],
  'Hà Tĩnh': [
    'Phường Thành Sen',
    'Phường Bắc Hà',
    'Phường Hồng Lĩnh',
    'Phường Kỳ Anh',
    'Xã Thạch Hà',
    'Xã Cẩm Xuyên',
    'Xã Can Lộc',
    'Xã Nghi Xuân',
    'Xã Hương Sơn',
    'Xã Đức Thọ',
  ],
  'Quảng Trị': [
    'Phường Đông Hà',
    'Phường Đồng Hới',
    'Phường Ba Đồn',
    'Phường Quảng Trị',
    'Xã Vĩnh Linh',
    'Xã Gio Linh',
    'Xã Lệ Thủy',
    'Xã Quảng Ninh',
    'Xã Bố Trạch',
    'Đặc khu Cồn Cỏ',
  ],
  'Quảng Ngãi': [
    'Phường Cẩm Thành',
    'Phường Trần Phú',
    'Phường Đức Phổ',
    'Phường Kon Tum',
    'Xã Bình Sơn',
    'Xã Sơn Tịnh',
    'Xã Tư Nghĩa',
    'Xã Mộ Đức',
    'Đặc khu Lý Sơn',
  ],
  'Gia Lai': [
    'Phường Pleiku',
    'Phường Quy Nhơn',
    'Phường An Nhơn',
    'Phường Hoài Nhơn',
    'Phường An Khê',
    'Phường Ayun Pa',
    'Xã Chư Sê',
    'Xã Đak Đoa',
    'Xã Tuy Phước',
    'Xã Phù Cát',
  ],
  'Khánh Hòa': [
    'Phường Nha Trang',
    'Phường Cam Ranh',
    'Phường Ninh Hòa',
    'Phường Phan Rang',
    'Xã Diên Khánh',
    'Xã Vạn Ninh',
    'Xã Cam Lâm',
    'Xã Ninh Phước',
    'Đặc khu Trường Sa',
  ],
  'Đắk Lắk': [
    'Phường Buôn Ma Thuột',
    'Phường Tuy Hòa',
    'Phường Sông Cầu',
    'Phường Đông Hòa',
    'Phường Buôn Hồ',
    'Xã Cư Mgar',
    'Xã Krông Pắc',
    'Xã Ea Kar',
  ],
  'Lâm Đồng': [
    'Phường Xuân Hương - Đà Lạt',
    'Phường Bảo Lộc',
    'Phường Phan Thiết',
    'Phường La Gi',
    'Phường Gia Nghĩa',
    'Xã Đức Trọng',
    'Xã Di Linh',
    'Xã Lâm Hà',
    'Đặc khu Phú Quý',
  ],
  'Tây Ninh': [
    'Phường Tây Ninh',
    'Phường Hòa Thành',
    'Phường Trảng Bàng',
    'Phường Tân An',
    'Phường Kiến Tường',
    'Xã Bến Lức',
    'Xã Đức Hòa',
    'Xã Cần Giuộc',
    'Xã Cần Đước',
  ],
  'Đồng Tháp': [
    'Phường Cao Lãnh',
    'Phường Sa Đéc',
    'Phường Hồng Ngự',
    'Phường Mỹ Tho',
    'Phường Gò Công',
    'Phường Cai Lậy',
    'Xã Châu Thành',
    'Xã Chợ Gạo',
    'Xã Lấp Vò',
  ],
  'Vĩnh Long': [
    'Phường Long Châu',
    'Phường Bình Minh',
    'Phường Bến Tre',
    'Phường Trà Vinh',
    'Phường Duyên Hải',
    'Xã Long Hồ',
    'Xã Mang Thít',
    'Xã Mỏ Cày',
    'Xã Châu Thành',
  ],
  'An Giang': [
    'Phường Long Xuyên',
    'Phường Châu Đốc',
    'Phường Rạch Giá',
    'Phường Hà Tiên',
    'Phường Tân Châu',
    'Xã Chợ Mới',
    'Xã Thoại Sơn',
    'Đặc khu Phú Quốc',
    'Đặc khu Kiên Hải',
  ],
  'Cà Mau': [
    'Phường Tân Thành',
    'Phường An Xuyên',
    'Phường Bạc Liêu',
    'Phường Giá Rai',
    'Xã Năm Căn',
    'Xã Đầm Dơi',
    'Xã Cái Nước',
    'Xã Trần Văn Thời',
    'Xã Vĩnh Lợi',
  ],
  'Cao Bằng': [
    'Phường Hợp Giang',
    'Phường Sông Bằng',
    'Phường Sông Hiến',
    'Xã Hòa An',
    'Xã Quảng Hòa',
    'Xã Trùng Khánh',
    'Xã Nguyên Bình',
    'Xã Bảo Lạc',
  ],
  'Tuyên Quang': [
    'Phường Phan Thiết',
    'Phường Tân Quang',
    'Phường Minh Xuân',
    'Phường Hà Giang',
    'Xã Yên Sơn',
    'Xã Sơn Dương',
    'Xã Hàm Yên',
    'Xã Chiêm Hóa',
    'Xã Vị Xuyên',
    'Xã Đồng Văn',
  ],
  'Điện Biên': [
    'Phường Mường Thanh',
    'Phường Him Lam',
    'Phường Mường Lay',
    'Xã Điện Biên',
    'Xã Tuần Giáo',
    'Xã Mường Ảng',
    'Xã Mường Nhé',
  ],
  'Lai Châu': [
    'Phường Đoàn Kết',
    'Phường Quyết Thắng',
    'Phường Tân Phong',
    'Xã Tam Đường',
    'Xã Phong Thổ',
    'Xã Than Uyên',
    'Xã Tân Uyên',
  ],
  'Sơn La': [
    'Phường Chiềng Lề',
    'Phường Tô Hiệu',
    'Phường Quyết Tâm',
    'Phường Mộc Châu',
    'Xã Mai Sơn',
    'Xã Thuận Châu',
    'Xã Yên Châu',
    'Xã Phù Yên',
  ],
  'Lào Cai': [
    'Phường Kim Tân',
    'Phường Bắc Cường',
    'Phường Sa Pa',
    'Phường Yên Bái',
    'Phường Nghĩa Lộ',
    'Xã Bảo Thắng',
    'Xã Bát Xát',
    'Xã Văn Yên',
    'Xã Trấn Yên',
  ],
  'Thái Nguyên': [
    'Phường Phan Đình Phùng',
    'Phường Hoàng Văn Thụ',
    'Phường Sông Công',
    'Phường Phổ Yên',
    'Phường Bắc Kạn',
    'Xã Đại Từ',
    'Xã Định Hóa',
    'Xã Phú Lương',
    'Xã Đồng Hỷ',
    'Xã Phú Bình',
  ],
  'Lạng Sơn': [
    'Phường Hoàng Văn Thụ',
    'Phường Vĩnh Trại',
    'Phường Đông Kinh',
    'Phường Chi Lăng',
    'Xã Cao Lộc',
    'Xã Hữu Lũng',
    'Xã Lộc Bình',
    'Xã Văn Lãng',
  ],
};

export interface ParsedAddressParts {
  detail: string;
  commune: string;
  province: string;
}

/**
 * Chuẩn hóa tên tỉnh để khớp với danh sách 34 Tỉnh/Thành phố chuẩn
 */
export function matchStandardProvince(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/^(tỉnh|thành phố|tp\.?)\s+/i, '')
    .trim();
  if (!cleaned) return '';

  const lower = cleaned.toLowerCase();
  if (
    lower === 'hồ chí minh' ||
    lower === 'tphcm' ||
    lower === 'hcm' ||
    raw.trim().toLowerCase() === 'tp. hồ chí minh'
  ) {
    return 'TP. Hồ Chí Minh';
  }
  if (lower === 'thừa thiên huế' || lower === 'huế') {
    return 'Huế';
  }
  if (lower === 'hòa bình' || lower === 'vĩnh phúc') {
    return 'Phú Thọ';
  }

  const found = VN_34_PROVINCES.find(
    (p) =>
      p.toLowerCase() === lower ||
      p.replace(/^TP\.\s*/i, '').toLowerCase() === lower
  );
  return found || '';
}

/**
 * Ghép 3 phần địa chỉ thành chuỗi: [Địa chỉ chi tiết], [Xã/Phường], [Tỉnh/Thành phố]
 */
export function composeAddressFromParts(
  detail: string,
  commune: string,
  province: string
): string {
  const parts = [detail.trim(), commune.trim(), province.trim()].filter(
    (p) => p.length > 0 && p !== '-' && p !== '—'
  );
  return parts.join(', ');
}

/**
 * Tách chuỗi địa chỉ theo dấu phẩy để điền ngược lại vào 3 ô:
 * [Địa chỉ chi tiết], [Xã/Phường], [Tỉnh/Thành phố]
 */
export function parseAddressIntoParts(
  fullAddress?: string | null
): ParsedAddressParts {
  if (!fullAddress) {
    return { detail: '', commune: '', province: '' };
  }
  const trimmed = fullAddress.trim();
  if (!trimmed || trimmed === '-' || trimmed === '—') {
    return { detail: '', commune: '', province: '' };
  }

  const segments = trimmed
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return { detail: '', commune: '', province: '' };
  }

  if (segments.length === 1) {
    const matchedProv = matchStandardProvince(segments[0]);
    if (matchedProv) {
      return { detail: '', commune: '', province: matchedProv };
    }
    return { detail: segments[0], commune: '', province: '' };
  }

  if (segments.length === 2) {
    const matchedProv = matchStandardProvince(segments[1]);
    if (matchedProv) {
      const firstLower = segments[0].toLowerCase();
      const looksLikeCommune =
        firstLower.startsWith('xã ') ||
        firstLower.startsWith('phường ') ||
        firstLower.startsWith('thị trấn ') ||
        firstLower.startsWith('đặc khu ');
      if (looksLikeCommune) {
        return { detail: '', commune: segments[0], province: matchedProv };
      }
      return { detail: segments[0], commune: '', province: matchedProv };
    }
    return {
      detail: segments[0],
      commune: segments[1],
      province: '',
    };
  }

  // segments.length >= 3
  const lastSeg = segments[segments.length - 1];
  const matchedProv = matchStandardProvince(lastSeg) || lastSeg;
  const commune = segments[segments.length - 2];
  const detail = segments.slice(0, segments.length - 2).join(', ');

  return {
    detail,
    commune,
    province: VN_34_PROVINCES.includes(matchedProv) ? matchedProv : '',
  };
}

/**
 * Nạp danh sách Xã/Phường/Đặc khu gợi ý theo Tỉnh/Thành phố (34 Tỉnh/TP sau sáp nhập)
 */
export async function fetchCommunesForProvince(
  provinceName: string
): Promise<string[]> {
  if (!provinceName) return [];
  return (
    DEFAULT_COMMUNES_BY_PROVINCE[provinceName] || [
      `Phường Trung tâm (${provinceName})`,
      `Xã Tân Thành`,
      `Xã Hòa Bình`,
      `Phường Thống Nhất`,
    ]
  );
}
