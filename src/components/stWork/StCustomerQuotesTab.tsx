import React from 'react';
import { FileSpreadsheet } from 'lucide-react';

export const StCustomerQuotesTab: React.FC = () => {
  return (
    <div className="flex-1 min-h-[360px] bg-white border border-slate-200 rounded-xl flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-3">
        <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 text-[#14539E] flex items-center justify-center mx-auto">
          <FileSpreadsheet className="w-6 h-6" />
        </div>
        <h2 className="text-sm font-bold text-slate-900">
          Báo giá khách hàng
        </h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          Phân hệ Báo giá khách hàng đang được chuẩn bị và sẽ kích hoạt ở giai đoạn tiếp theo.
        </p>
      </div>
    </div>
  );
};
