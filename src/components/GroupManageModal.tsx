import React, { useState } from 'react';
import { X, Plus, Trash2, FolderCog } from 'lucide-react';
import { DepartmentGroup, Employee } from '../types/hr';

interface GroupManageModalProps {
  isOpen: boolean;
  groups: DepartmentGroup[];
  employees: Employee[];
  onClose: () => void;
  onAddGroup: (group: Omit<DepartmentGroup, 'id'>) => void;
  onDeleteGroup: (id: string) => void;
}

const COLORS = ['#0D9488', '#0284C7', '#7C3AED', '#D97706', '#E11D48', '#16A34A'];

export const GroupManageModal: React.FC<GroupManageModalProps> = ({
  isOpen,
  groups,
  employees,
  onClose,
  onAddGroup,
  onDeleteGroup,
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [color, setColor] = useState(COLORS[0]);

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAddGroup({
      name: name.trim(),
      code: code.trim().toUpperCase() || 'GRP',
      color,
    });
    setName('');
    setCode('');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="group-modal-title"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden">
        <div className="bg-[#0F232E] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FolderCog className="w-5 h-5 text-[#2DD4BF]" />
            <div>
              <h3 id="group-modal-title" className="text-sm font-bold">
                Quản lý Nhóm / Bộ phận
              </h3>
              <p className="text-xs text-slate-300">
                Thiết lập danh mục phòng ban cho toàn hệ thống
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ quản lý nhóm"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tên Nhóm / Phòng ban mới..."
              aria-label="Tên nhóm mới"
              className="sm:col-span-6 px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488]"
            />
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Mã (VD: MKT)"
              aria-label="Mã nhóm"
              className="sm:col-span-3 px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488]"
            />
            <button
              type="submit"
              className="sm:col-span-3 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm</span>
            </button>
          </form>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Màu sắc biểu đồ:</span>
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Chọn màu ${c}`}
                className={`w-5 h-5 rounded-full transition-transform cursor-pointer ${
                  color === c ? 'scale-125 ring-2 ring-offset-1 ring-slate-400' : ''
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg max-h-64 overflow-y-auto">
            {groups.map((grp) => {
              const memberCount = employees.filter(
                (e) => e.department === grp.name
              ).length;
              return (
                <div
                  key={grp.id}
                  className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: grp.color }}
                    />
                    <span className="font-semibold text-slate-800 truncate">
                      {grp.name}
                    </span>
                    <span className="font-mono text-slate-400">({grp.code})</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono tabular-nums text-slate-500">
                      {memberCount} NV
                    </span>
                    <button
                      type="button"
                      disabled={memberCount > 0}
                      onClick={() => onDeleteGroup(grp.id)}
                      title={
                        memberCount > 0
                          ? 'Không thể xóa nhóm đang có nhân sự'
                          : 'Xóa nhóm'
                      }
                      aria-label={`Xóa nhóm ${grp.name}`}
                      className={`p-1 rounded ${
                        memberCount > 0
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
    </div>
  );
};
