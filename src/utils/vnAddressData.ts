/**
 * Danh sách chuẩn 34 Tỉnh / Thành phố sau sáp nhập của Việt Nam
 * gồm 6 Thành phố trực thuộc Trung ương và 28 Tỉnh
 * kèm bộ xử lý tách/ghép địa chỉ hành chính 2 cấp (Tỉnh/TP -> Xã/Phường -> Địa chỉ chi tiết)
 */

export const VN_6_CENTRAL_CITIES: string[] = [
  'Hà Nội',
  'TP. Hồ Chí Minh',
  'Hải Phòng',
  'Đà Nẵng',
  'Cần Thơ',
  'Huế',
];

export const VN_28_PROVINCES: string[] = [
  'An Giang',
  'Bắc Ninh',
  'Cà Mau',
  'Cao Bằng',
  'Đắk Lắk',
  'Điện Biên',
  'Đồng Nai',
  'Đồng Tháp',
  'Gia Lai',
  'Hà Tĩnh',
  'Hưng Yên',
  'Khánh Hòa',
  'Lai Châu',
  'Lâm Đồng',
  'Lạng Sơn',
  'Lào Cai',
  'Nghệ An',
  'Ninh Bình',
  'Phú Thọ',
  'Quảng Ngãi',
  'Quảng Ninh',
  'Quảng Trị',
  'Sơn La',
  'Tây Ninh',
  'Thái Nguyên',
  'Thanh Hóa',
  'Tuyên Quang',
  'Vĩnh Long',
];

export const VN_34_PROVINCES: string[] = [
  ...VN_6_CENTRAL_CITIES,
  ...VN_28_PROVINCES,
];

/**
 * Danh sách Xã / Phường / Thị trấn / Đặc khu chuẩn sau sáp nhập theo từng Tỉnh/Thành phố (34 Tỉnh/TP)
 */
export const DEFAULT_COMMUNES_BY_PROVINCE: Record<string, string[]> = {
  'Phú Thọ': [
    'Xã Lương Sơn',
    'Phường Hòa Bình',
    'Phường Kỳ Sơn',
    'Phường Tân Hòa',
    'Phường Thống Nhất',
    'Phường Đồng Tiến',
    'Phường Phương Lâm',
    'Phường Hữu Nghị',
    'Phường Thịnh Lang',
    'Phường Việt Trì',
    'Phường Gia Cẩm',
    'Phường Nông Trang',
    'Phường Tân Dân',
    'Phường Vân Phú',
    'Phường Bạch Hạc',
    'Phường Âu Cơ',
    'Phường Phong Châu',
    'Phường Hùng Vương',
    'Phường Vĩnh Yên',
    'Phường Liên Bảo',
    'Phường Khai Quang',
    'Phường Đồng Tâm',
    'Phường Tích Sơn',
    'Phường Phúc Yên',
    'Phường Hùng Thắng',
    'Phường Xuân Hòa',
    'Xã Hòa Sơn',
    'Xã Nhuận Trạch',
    'Xã Cư Yên',
    'Xã Tân Vinh',
    'Xã Cao Dương',
    'Xã Thanh Cao',
    'Xã Liên Sơn',
    'Xã Đà Bắc',
    'Xã Kim Bôi',
    'Xã Lạc Thủy',
    'Xã Yên Thủy',
    'Xã Mai Châu',
    'Xã Tân Lạc',
    'Xã Cao Phong',
    'Xã Lạc Sơn',
    'Xã Thanh Sơn',
    'Xã Tân Sơn',
    'Xã Yên Lập',
    'Xã Hạ Hòa',
    'Xã Cẩm Khê',
    'Xã Đoan Hùng',
    'Xã Phù Ninh',
    'Xã Lâm Thao',
    'Xã Tam Nông',
    'Xã Thanh Thủy',
    'Xã Thanh Ba',
    'Xã Tam Đảo',
    'Xã Tam Dương',
    'Xã Bình Xuyên',
    'Xã Yên Lạc',
    'Xã Vĩnh Tường',
    'Xã Lập Thạch',
    'Xã Sông Lô',
  ],
  'Bắc Ninh': [
    'Phường Kinh Bắc',
    'Phường Suối Hoa',
    'Phường Võ Cường',
    'Phường Vũ Ninh',
    'Phường Đại Phúc',
    'Phường Thị Cầu',
    'Phường Đáp Cầu',
    'Phường Tiền An',
    'Phường Ninh Xá',
    'Phường Vạn An',
    'Phường Hạp Lĩnh',
    'Phường Khắc Niệm',
    'Phường Phong Khê',
    'Phường Từ Sơn',
    'Phường Đông Ngàn',
    'Phường Đình Bảng',
    'Phường Đồng Nguyên',
    'Phường Tân Hồng',
    'Phường Trang Hạ',
    'Phường Đồng Kỵ',
    'Phường Phố Mới',
    'Phường Quế Võ',
    'Phường Phượng Mao',
    'Phường Bằng An',
    'Phường Đại Xuân',
    'Phường Nhân Hòa',
    'Phường Thuận Thành',
    'Phường Hồ',
    'Phường Gia Đông',
    'Phường Thanh Khương',
    'Phường Trạm Lộ',
    'Phường Xuân Lâm',
    'Phường Bắc Giang',
    'Phường Hoàng Văn Thụ',
    'Phường Ngô Quyền',
    'Phường Trần Nguyên Hãn',
    'Phường Xương Giang',
    'Phường Dĩnh Kế',
    'Phường Việt Yên',
    'Phường Bích Động',
    'Phường Nếnh',
    'Phường Tăng Tiến',
    'Phường Hồng Thái',
    'Phường Quảng Minh',
    'Phường Vân Trung',
    'Phường Quang Châu',
    'Phường Chũ',
    'Xã Yên Phong',
    'Xãờ Chờ',
    'Xã Long Châu',
    'Xã Đông Phong',
    'Xã Thụy Hòa',
    'Xã Văn Môn',
    'Xã Yên Trung',
    'Xã Dũng Liệt',
    'Xã Tam Đa',
    'Xã Tiên Du',
    'Xã Lim',
    'Xã Nội Duệ',
    'Xã Liên Bão',
    'Xã Hoàn Sơn',
    'Xã Đại Đồng',
    'Xã Phật Tích',
    'Xã Gia Bình',
    'Xã Lương Tài',
    'Xã Hiệp Hòa',
    'Xã Tân Yên',
    'Xã Lạng Giang',
    'Xã Lục Nam',
    'Xã Lục Ngạn',
    'Xã Sơn Động',
    'Xã Yên Thế',
  ],
  'Hà Nội': [
    'Phường Ba Đình',
    'Phường Hoàn Kiếm',
    'Phường Đống Đa',
    'Phường Hai Bà Trưng',
    'Phường Cầu Giấy',
    'Phường Dịch Vọng',
    'Phường Mai Dịch',
    'Phường Trung Hòa',
    'Phường Thanh Xuân',
    'Phường Nhân Chính',
    'Phường Tây Hồ',
    'Phường Phú Thượng',
    'Phường Long Biên',
    'Phường Việt Hưng',
    'Phường Sài Đồng',
    'Phường Ngọc Thụy',
    'Phường Hà Đông',
    'Phường Mỗ Lao',
    'Phường Văn Quán',
    'Phường Dương Nội',
    'Phường Yên Nghĩa',
    'Phường Nam Từ Liêm',
    'Phường Mỹ Đình',
    'Phường Mễ Trì',
    'Phường Tây Mỗ',
    'Phường Đại Mỗ',
    'Phường Bắc Từ Liêm',
    'Phường Cổ Nhuế',
    'Phường Xuân Đỉnh',
    'Phường Phú Diễn',
    'Phường Hoàng Mai',
    'Phường Định Công',
    'Phường Hoàng Liệt',
    'Phường Lĩnh Nam',
    'Phường Sơn Tây',
    'Xã Đông Anh',
    'Xã Hải Bối',
    'Xã Kim Chung',
    'Xã Nguyên Khê',
    'Xã Tiên Dương',
    'Xã Vĩnh Ngọc',
    'Xã Xuân Canh',
    'Xã Gia Lâm',
    'Xã Trâu Quỳ',
    'Xã Đa Tốn',
    'Xã Kiêu Kỵ',
    'Xã Yên Viên',
    'Xã Ninh Hiệp',
    'Xã Thanh Trì',
    'Xã Văn Điển',
    'Xã Tứ Hiệp',
    'Xã Ngọc Hồi',
    'Xã Sóc Sơn',
    'Xã Phú Minh',
    'Xã Quang Tiến',
    'Xã Mê Linh',
    'Xã Quang Minh',
    'Xã Chi Đông',
    'Xã Hoài Đức',
    'Xã An Khánh',
    'Xã Đan Phượng',
    'Xã Phúc Thọ',
    'Xã Chương Mỹ',
    'Xã Xuân Mai',
    'Xã Quốc Oai',
    'Xã Thạch Thất',
    'Xã Hòa Lạc',
    'Xã Thường Tín',
    'Xã Phú Xuyên',
    'Xã Thanh Oai',
    'Xã Mỹ Đức',
    'Xã Ứng Hòa',
    'Xã Ba Vì',
  ],
  'Thái Nguyên': [
    'Phường Phan Đình Phùng',
    'Phường Hoàng Văn Thụ',
    'Phường Trưng Vương',
    'Phường Quang Trung',
    'Phường Đồng Quang',
    'Phường Gia Sàng',
    'Phường Túc Duyên',
    'Phường Tân Thịnh',
    'Phường Thịnh Đán',
    'Phường Sông Công',
    'Phường Thắng Lợi',
    'Phường Mỏ Chè',
    'Phường Bách Quang',
    'Phường Phổ Yên',
    'Phường Ba Hàng',
    'Phường Bãi Bông',
    'Phường Đồng Tiến',
    'Phường Hồng Tiến',
    'Phường Nam Tiến',
    'Phường Bắc Kạn',
    'Phường Đức Xuân',
    'Xã Đại Từ',
    'Xã Định Hóa',
    'Xã Phú Lương',
    'Xã Đồng Hỷ',
    'Xã Phú Bình',
    'Xã Điềm Thụy',
    'Xã Kha Sơn',
    'Xã Võ Nhai',
    'Xã Ba Bể',
    'Xã Chợ Đồn',
    'Xã Chợ Mới',
    'Xã Bạch Thông',
    'Xã Na Rì',
  ],
  'Hưng Yên': [
    'Phường Lam Sơn',
    'Phường Hiến Nam',
    'Phường An Tảo',
    'Phường Lê Lợi',
    'Phường Minh Khai',
    'Phường Mỹ Hào',
    'Phường Bần Yên Nhân',
    'Phường Nhân Hòa',
    'Phường Phùng Chí Kiên',
    'Phường Dị Sử',
    'Phường Thái Bình',
    'Phường Trần Hưng Đạo',
    'Phường Kỳ Bá',
    'Phường Quang Trung',
    'Phường Tiền Phong',
    'Xã Văn Giang',
    'Xã Ecopark',
    'Xã Văn Lâm',
    'Xã Như Quỳnh',
    'Xã Tân Quang',
    'Xã Yên Mỹ',
    'Xã Giai Phạm',
    'Xã Nghĩa Hiệp',
    'Xã Khoái Châu',
    'Xã Kim Động',
    'Xã Ân Thi',
    'Xã Tiên Lữ',
    'Xã Phù Cừ',
    'Xã Đông Hưng',
    'Xã Hưng Hà',
    'Xã Kiến Xương',
    'Xã Quỳnh Phụ',
    'Xã Thái Thụy',
    'Xã Tiền Hải',
    'Xã Vũ Thư',
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
    'Phường An Dương',
    'Phường Hải Dương',
    'Phường Bình Hàn',
    'Phường Cẩm Thượng',
    'Phường Tân Bình',
    'Phường Thanh Bình',
    'Phường Chí Linh',
    'Phường Sao Đỏ',
    'Phường Kinh Môn',
    'Xã An Lão',
    'Xã Kiến Thụy',
    'Xã Tiên Lãng',
    'Xã Vĩnh Bảo',
    'Xã Cẩm Giàng',
    'Xã Bình Giang',
    'Xã Gia Lộc',
    'Xã Kim Thành',
    'Xã Nam Sách',
    'Xã Ninh Giang',
    'Xã Thanh Hà',
    'Xã Thanh Miện',
    'Xã Tứ Kỳ',
    'Đặc khu Bạch Long Vĩ',
    'Đặc khu Cát Hải',
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
    'Phường Tân Uyên',
    'Phường Bến Cát',
    'Phường Vũng Tàu',
    'Phường Bà Rịa',
    'Phường Phú Mỹ',
    'Xã Củ Chi',
    'Xã Hóc Môn',
    'Xã Bình Chánh',
    'Xã Nhà Bè',
    'Xã Cần Giờ',
    'Đặc khu Côn Đảo',
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
    'Phường Điện Bàn',
    'Xã Hòa Vang',
    'Xã Đại Lộc',
    'Xã Duy Xuyên',
    'Xã Thăng Bình',
    'Xã Núi Thành',
    'Xã Quế Sơn',
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
    'Phường Long Bình',
    'Phường Long Khánh',
    'Phường Đồng Xoài',
    'Phường Phước Long',
    'Phường Bình Long',
    'Phường Chơn Thành',
    'Xã Long Thành',
    'Xã Nhơn Trạch',
    'Xã Trảng Bom',
    'Xã Vĩnh Cửu',
    'Xã Xuân Lộc',
    'Xã Định Quán',
  ],
  'Quảng Ninh': [
    'Phường Hạ Long',
    'Phường Bãi Cháy',
    'Phường Hồng Gai',
    'Phường Hồng Hải',
    'Phường Cẩm Phả',
    'Phường Uông Bí',
    'Phường Móng Cái',
    'Phường Đông Triều',
    'Phường Quảng Yên',
    'Xã Tiên Yên',
    'Xã Đầm Hà',
    'Xã Hải Hà',
    'Xã Bình Liêu',
    'Đặc khu Vân Đồn',
    'Đặc khu Cô Tô',
  ],
  'Ninh Bình': [
    'Phường Hoa Lư',
    'Phường Đông Thành',
    'Phường Tân Thành',
    'Phường Tam Điệp',
    'Phường Nam Định',
    'Phường Phủ Lý',
    'Phường Duy Tiên',
    'Phường Kim Bảng',
    'Xã Gia Viễn',
    'Xã Nho Quan',
    'Xã Yên Khánh',
    'Xã Yên Mô',
    'Xã Kim Sơn',
    'Xã Thanh Liêm',
    'Xã Bình Lục',
    'Xã Lý Nhân',
    'Xã Hải Hậu',
    'Xã Xuân Trường',
    'Xã Giao Thủy',
    'Xã Nghĩa Hưng',
    'Xã Nam Trực',
    'Xã Trực Ninh',
    'Xã Vụ Bản',
    'Xã Ý Yên',
  ],
  'Thanh Hóa': [
    'Phường Hạc Thành',
    'Phường Đông Hương',
    'Phường Đông Vệ',
    'Phường Lam Sơn',
    'Phường Sầm Sơn',
    'Phường Bỉm Sơn',
    'Phường Nghi Sơn',
    'Xã Quảng Xương',
    'Xã Hoằng Hóa',
    'Xã Hậu Lộc',
    'Xã Nga Sơn',
    'Xã Hà Trung',
    'Xã Thọ Xuân',
    'Xã Triệu Sơn',
    'Xã Nông Cống',
    'Xã Đông Sơn',
    'Xã Thiệu Hóa',
    'Xã Yên Định',
    'Xã Vĩnh Lộc',
    'Xã Cẩm Thủy',
    'Xã Ngọc Lặc',
  ],
  'Nghệ An': [
    'Phường Trường Thi',
    'Phường Hưng Dũng',
    'Phường Hà Huy Tập',
    'Phường Quang Trung',
    'Phường Cửa Lò',
    'Phường Hoàng Mai',
    'Phường Thái Hòa',
    'Xã Nghi Lộc',
    'Xã Diễn Châu',
    'Xã Quỳnh Lưu',
    'Xã Yên Thành',
    'Xã Đô Lương',
    'Xã Thanh Chương',
    'Xã Nam Đàn',
    'Xã Hưng Nguyên',
    'Xã Nghĩa Đàn',
  ],
  'Hà Tĩnh': [
    'Phường Thành Sen',
    'Phường Bắc Hà',
    'Phường Nam Hà',
    'Phường Hồng Lĩnh',
    'Phường Kỳ Anh',
    'Xã Thạch Hà',
    'Xã Cẩm Xuyên',
    'Xã Can Lộc',
    'Xã Nghi Xuân',
    'Xã Hương Sơn',
    'Xã Hương Khê',
    'Xã Đức Thọ',
    'Xã Lộc Hà',
  ],
  'Quảng Trị': [
    'Phường Đông Hà',
    'Phường Đồng Hới',
    'Phường Ba Đồn',
    'Phường Quảng Trị',
    'Xã Vĩnh Linh',
    'Xã Gio Linh',
    'Xã Cam Lộ',
    'Xã Triệu Phong',
    'Xã Hải Lăng',
    'Xã Lệ Thủy',
    'Xã Quảng Ninh',
    'Xã Bố Trạch',
    'Xã Quảng Trạch',
    'Xã Tuyên Hóa',
    'Đặc khu Cồn Cỏ',
  ],
  'Quảng Ngãi': [
    'Phường Cẩm Thành',
    'Phường Trần Phú',
    'Phường Nghĩa Chánh',
    'Phường Đức Phổ',
    'Phường Kon Tum',
    'Xã Bình Sơn',
    'Xã Sơn Tịnh',
    'Xã Tư Nghĩa',
    'Xã Mộ Đức',
    'Xã Nghĩa Hành',
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
    'Xã Phù Mỹ',
    'Xã Tây Sơn',
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
    'Xã Ea Hleo',
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
    'Xã Đơn Dương',
    'Đặc khu Phú Quý',
  ],
  'Tây Ninh': [
    'Phường Tây Ninh',
    'Phường Hòa Thành',
    'Phường Trảng Bàng',
    'Phường Gò Dầu',
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
    'Xã Lai Vung',
  ],
  'Vĩnh Long': [
    'Phường Long Châu',
    'Phường Bình Minh',
    'Phường Bến Tre',
    'Phường Trà Vinh',
    'Phường Duyên Hải',
    'Xã Long Hồ',
    'Xã Mang Thít',
    'Xã Tam Bình',
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
    'Xã Châu Phú',
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
    'Phường Đề Thám',
    'Xã Hòa An',
    'Xã Quảng Hòa',
    'Xã Trùng Khánh',
    'Xã Nguyên Bình',
    'Xã Bảo Lạc',
    'Xã Thạch An',
  ],
  'Tuyên Quang': [
    'Phường Phan Thiết',
    'Phường Tân Quang',
    'Phường Minh Xuân',
    'Phường Nông Tiến',
    'Phường Hà Giang',
    'Xã Yên Sơn',
    'Xã Sơn Dương',
    'Xã Hàm Yên',
    'Xã Chiêm Hóa',
    'Xã Na Hang',
    'Xã Vị Xuyên',
    'Xã Bắc Quang',
    'Xã Đồng Văn',
  ],
  'Điện Biên': [
    'Phường Mường Thanh',
    'Phường Him Lam',
    'Phường Nam Thanh',
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
    'Phường Quyết Thắng',
    'Phường Quyết Tâm',
    'Phường Mộc Châu',
    'Xã Mai Sơn',
    'Xã Thuận Châu',
    'Xã Yên Châu',
    'Xã Phù Yên',
    'Xã Bắc Yên',
  ],
  'Lào Cai': [
    'Phường Kim Tân',
    'Phường Bắc Cường',
    'Phường Nam Cường',
    'Phường Cốc Lếu',
    'Phường Sa Pa',
    'Phường Yên Bái',
    'Phường Đồng Tâm',
    'Phường Nghĩa Lộ',
    'Xã Bảo Thắng',
    'Xã Bát Xát',
    'Xã Bảo Yên',
    'Xã Văn Bàn',
    'Xã Văn Yên',
    'Xã Trấn Yên',
    'Xã Yên Bình',
    'Xã Lục Yên',
  ],
  'Lạng Sơn': [
    'Phường Hoàng Văn Thụ',
    'Phường Vĩnh Trại',
    'Phường Đông Kinh',
    'Phường Tam Thanh',
    'Phường Chi Lăng',
    'Xã Cao Lộc',
    'Xã Hữu Lũng',
    'Xã Lộc Bình',
    'Xã Văn Lãng',
    'Xã Bắc Sơn',
    'Xã Tràng Định',
  ],
};

export interface ParsedAddressParts {
  detail: string;
  commune: string;
  province: string;
}

const MERGED_PROVINCE_ALIASES: Record<string, string> = {
  'hồ chí minh': 'TP. Hồ Chí Minh',
  'tphcm': 'TP. Hồ Chí Minh',
  'hcm': 'TP. Hồ Chí Minh',
  'bình dương': 'TP. Hồ Chí Minh',
  'bà rịa - vũng tàu': 'TP. Hồ Chí Minh',
  'bà rịa vũng tàu': 'TP. Hồ Chí Minh',
  'hải dương': 'Hải Phòng',
  'quảng nam': 'Đà Nẵng',
  'hậu giang': 'Cần Thơ',
  'sóc trăng': 'Cần Thơ',
  'thừa thiên huế': 'Huế',
  'thừa thiên - huế': 'Huế',
  'hòa bình': 'Phú Thọ',
  'hoà bình': 'Phú Thọ',
  'vĩnh phúc': 'Phú Thọ',
  'bắc giang': 'Bắc Ninh',
  'thái bình': 'Hưng Yên',
  'hà nam': 'Ninh Bình',
  'nam định': 'Ninh Bình',
  'quảng bình': 'Quảng Trị',
  'kon tum': 'Quảng Ngãi',
  'bình định': 'Gia Lai',
  'ninh thuận': 'Khánh Hòa',
  'phú yên': 'Đắk Lắk',
  'bình thuận': 'Lâm Đồng',
  'đắk nông': 'Lâm Đồng',
  'bình phước': 'Đồng Nai',
  'long an': 'Tây Ninh',
  'tiền giang': 'Đồng Tháp',
  'bến tre': 'Vĩnh Long',
  'trà vinh': 'Vĩnh Long',
  'kiên giang': 'An Giang',
  'bạc liêu': 'Cà Mau',
  'hà giang': 'Tuyên Quang',
  'yên bái': 'Lào Cai',
  'bắc kạn': 'Thái Nguyên',
};

/**
 * Chuẩn hóa tên tỉnh để khớp với danh sách 34 Tỉnh/Thành phố chuẩn sau sáp nhập
 */
export function matchStandardProvince(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/^(tỉnh|thành phố|tp\.?)\s+/i, '')
    .trim();
  if (!cleaned) return '';

  const lower = cleaned.toLowerCase();
  if (raw.trim().toLowerCase() === 'tp. hồ chí minh') {
    return 'TP. Hồ Chí Minh';
  }
  if (MERGED_PROVINCE_ALIASES[lower]) {
    return MERGED_PROVINCE_ALIASES[lower];
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
      const looksLikeDetailOnly =
        firstLower.startsWith('thôn ') ||
        firstLower.startsWith('xóm ') ||
        firstLower.startsWith('số ') ||
        firstLower.startsWith('ngõ ') ||
        firstLower.startsWith('đường ') ||
        firstLower.startsWith('tổ ') ||
        firstLower.startsWith('khu ');
      if (looksLikeDetailOnly) {
        return { detail: segments[0], commune: '', province: matchedProv };
      }
      return { detail: '', commune: segments[0], province: matchedProv };
    }
    return {
      detail: '',
      commune: segments[0],
      province: matchStandardProvince(segments[1]) || segments[1],
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
    province: VN_34_PROVINCES.includes(matchedProv) ? matchedProv : lastSeg,
  };
}

/**
 * Định dạng địa chỉ rút gọn chuẩn 2 cấp [Xã/Phường], [Tỉnh/Thành phố]
 * (Ví dụ: "Xã Lương Sơn, Phú Thọ" hoặc "Phường Kinh Bắc, Bắc Ninh")
 * dùng cho cột ĐỊA CHỈ ngoài bảng danh sách nhân sự để luôn gọn trên 1 dòng.
 */
export function formatCommuneProvinceAddress(
  fullAddress?: string | null
): string {
  if (!fullAddress) return '';
  const trimmed = fullAddress.trim();
  if (!trimmed || trimmed === '-' || trimmed === '—') return '';

  const { commune, province, detail } = parseAddressIntoParts(trimmed);
  const cleanCommune = commune.trim();
  const cleanProvince = province.trim();

  if (cleanCommune && cleanProvince) {
    return `${cleanCommune}, ${cleanProvince}`;
  }
  if (cleanProvince) {
    return cleanProvince;
  }
  if (cleanCommune) {
    return cleanCommune;
  }
  return detail.trim() || trimmed;
}

/**
 * Nạp danh sách Xã/Phường/Đặc khu gợi ý theo Tỉnh/Thành phố (34 Tỉnh/TP sau sáp nhập)
 */
export async function fetchCommunesForProvince(
  provinceName: string
): Promise<string[]> {
  if (!provinceName) return [];
  const normalized = matchStandardProvince(provinceName) || provinceName;
  return (
    DEFAULT_COMMUNES_BY_PROVINCE[normalized] || [
      `Phường Trung tâm (${normalized})`,
      `Xã Tân Thành`,
      `Xã Hòa Bình`,
      `Phường Thống Nhất`,
    ]
  );
}
