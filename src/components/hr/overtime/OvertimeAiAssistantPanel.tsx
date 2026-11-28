import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Image as ImageIcon,
  Layers,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { Employee } from '../../../types/hr';
import type {
  OvertimeGlossaryEntry,
  OvertimeLeaveCheckEntry,
} from '../../../services/hrService';
import {
  buildOnLeaveEmployeeMapForDate,
  filterAndSortGlossaryForCombobox,
  normalizeTargetGroups,
} from '../../../services/hrService';
import { formatNumberVN } from '../../../utils/errorAndSecurityService';
import { formatDateToFormStyle } from '../../../utils/overtimeExportService';
import {
  calculateActualOvertimeHours,
  evaluateOvertimeDaySchedule,
  getWeekdayKeyFromIsoDate,
  type CompanyHoliday,
  type OvertimeSettings,
  type WorkShift,
} from '../../../utils/workScheduleLogic';
import {
  evaluateAiBlockLeaveConflicts,
  type AiParsedOvertimeBlock,
} from '../../../utils/overtimeImageParseLogic';
import type { OvertimeTaskBlock } from './CreateOvertimeForm';

export type AiAssistantTabId = 'ai_scan' | 'glossary' | 'recorded';

export interface OvertimeAiAssistantPanelProps {
  activeTab: AiAssistantTabId;
  onSelectTab: (tab: AiAssistantTabId) => void;
  isLockedForm: boolean;
  isCommittingBlock: boolean;

  // AI Image Scan props
  pastedImagePreviewUrl: string | null;
  isScanningImage: boolean;
  scanError: string | null;
  parsedAiBlocks: AiParsedOvertimeBlock[];
  onImageFileSelected: (file: File) => void;
  onRescanImage: () => void;
  onClearAiScan: () => void;
  onApplyAiBlockToForm: (block: AiParsedOvertimeBlock) => void;
  onCommitAiBlockImmediately: (block: AiParsedOvertimeBlock) => Promise<void> | void;

  // Glossary props
  glossaryEntries: OvertimeGlossaryEntry[];
  selectedGroupFilter: string;
  selectedEmployeeDepartments: string[];
  onSelectGlossaryCard: (entry: OvertimeGlossaryEntry) => void;

  // Recorded blocks props
  previewData: OvertimeTaskBlock[];
  editingBlockId: string | null;
  shellOvertimeDate: string;
  summaryStats: {
    blockCount: number;
    totalParticipants: number;
    totalHours: number;
    datesCount: number;
  };
  employeeMap: Map<string, Employee>;
  effectiveLeaveRecords: OvertimeLeaveCheckEntry[];
  companyHolidays: CompanyHoliday[];
  effectiveWorkShifts: WorkShift[];
  overtimeSettings: OvertimeSettings;
  onEditBlock: (index: number) => void;
  onMoveBlock: (index: number, direction: 'up' | 'down') => void;
  onRemoveBlock: (index: number) => void;
}

export const OvertimeAiAssistantPanel: React.FC<
  OvertimeAiAssistantPanelProps
> = ({
  activeTab,
  onSelectTab,
  isLockedForm,
  isCommittingBlock,
  pastedImagePreviewUrl,
  isScanningImage,
  scanError,
  parsedAiBlocks,
  onImageFileSelected,
  onRescanImage,
  onClearAiScan,
  onApplyAiBlockToForm,
  onCommitAiBlockImmediately,
  glossaryEntries,
  selectedGroupFilter,
  selectedEmployeeDepartments,
  onSelectGlossaryCard,
  previewData,
  editingBlockId,
  shellOvertimeDate,
  summaryStats,
  employeeMap,
  effectiveLeaveRecords,
  companyHolidays,
  effectiveWorkShifts,
  overtimeSettings,
  onEditBlock,
  onMoveBlock,
  onRemoveBlock,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [glossarySearch, setGlossarySearch] = useState('');
  const [committingAiBlockId, setCommittingAiBlockId] = useState<string | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const employeesList = useMemo(
    () => Array.from(employeeMap.values()),
    [employeeMap]
  );

  const filteredGlossaryCards = useMemo(() => {
    const base = filterAndSortGlossaryForCombobox({
      entries: glossaryEntries,
      selectedGroupFilter,
      selectedEmployeeDepartments,
      searchText: '',
    });
    const query = glossarySearch.trim().toLowerCase();
    if (!query) return base;
    return base.filter(
      (item) =>
        item.reasonVi.toLowerCase().includes(query) ||
        item.reasonKr.toLowerCase().includes(query)
    );
  }, [
    glossaryEntries,
    selectedGroupFilter,
    selectedEmployeeDepartments,
    glossarySearch,
  ]);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (isLockedForm || isScanningImage) return;
    const files = Array.from(e.dataTransfer.files || []);
    const imgFile = files.find((f) => f.type.startsWith('image/'));
    if (imgFile) {
      onImageFileSelected(imgFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onImageFileSelected(file);
    }
    e.target.value = '';
  };

  return (
    <div
      data-testid="overtime-column-2-assistant"
      className="w-full xl:w-[308px] 2xl:w-[332px] shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col xl:h-full min-h-0 overflow-hidden"
    >
      {/* Header 3 Tabs */}
      <div
        role="tablist"
        aria-label="Trợ giúp AI và Quản lý nhóm"
        className="flex items-center gap-1 p-1.5 bg-slate-50/90 border-b border-slate-200 shrink-0"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'ai_scan'}
          onClick={() => onSelectTab('ai_scan')}
          className={`h-8 px-2 rounded-lg text-[10px] font-bold inline-flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'ai_scan'
              ? 'bg-[#14539E] text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:text-[#14539E] hover:border-blue-200'
          }`}
        >
          <Camera className="w-3 h-3 shrink-0" />
          <span>Quét ảnh AI</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'glossary'}
          onClick={() => onSelectTab('glossary')}
          className={`flex-1 min-w-0 h-8 px-1.5 rounded-lg text-[10px] font-bold inline-flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'glossary'
              ? 'bg-[#14539E] text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:text-[#14539E] hover:border-blue-200'
          }`}
        >
          <BookOpen className="w-3 h-3 shrink-0" />
          <span>
            Lý do mẫu ({filteredGlossaryCards.length})
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'recorded'}
          onClick={() => onSelectTab('recorded')}
          className={`flex-1 min-w-0 h-8 px-1.5 rounded-lg text-[10px] font-bold inline-flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'recorded'
              ? 'bg-[#14539E] text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:text-[#14539E] hover:border-blue-200'
          }`}
        >
          <Layers className="w-3 h-3 shrink-0" />
          <span>Đã ghi nhận ({previewData.length})</span>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        {/* TAB 1: QUÉT ẢNH AI */}
        {activeTab === 'ai_scan' && (
          <div className="space-y-3" data-testid="ai-scan-tab-panel">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              aria-label="Tải ảnh lịch tăng ca"
            />

            <div
              onDragOver={(e) => {
                e.preventDefault();
                if (!isLockedForm) setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              className={`rounded-xl border-2 border-dashed p-3 text-center transition-colors ${
                isDragOver
                  ? 'border-[#14539E] bg-blue-50/70'
                  : 'border-slate-300 bg-slate-50/60 hover:border-[#14539E]/60'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-[#14539E] flex items-center justify-center mx-auto mb-1.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <p className="text-[11px] font-semibold text-slate-800 leading-snug">
                Dán trực tiếp ảnh từ Zalo (Ctrl + V) ở bất kỳ đâu trên màn hình này
              </p>
              <p className="text-[10px] text-slate-500 mt-1">
                Hoặc kéo thả ảnh vào khung này để AI tự bóc tách nhân sự, giờ & lý do
              </p>
              <button
                type="button"
                disabled={isLockedForm || isScanningImage}
                onClick={() => fileInputRef.current?.click()}
                className="mt-2.5 h-7 px-3 rounded-lg bg-white border border-slate-300 hover:border-[#14539E] hover:text-[#14539E] text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Upload className="w-3 h-3" />
                <span>Chọn ảnh từ máy</span>
              </button>
            </div>

            {pastedImagePreviewUrl && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700">
                    <ImageIcon className="w-3.5 h-3.5 text-[#14539E]" />
                    <span>Ảnh vừa dán / chọn</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={isScanningImage || isLockedForm}
                      onClick={onRescanImage}
                      className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-semibold text-slate-700 hover:border-[#14539E] hover:text-[#14539E] inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      title="Quét lại ảnh này"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      <span>Quét lại</span>
                    </button>
                    <button
                      type="button"
                      disabled={isScanningImage}
                      onClick={onClearAiScan}
                      className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer disabled:opacity-40"
                      title="Xóa ảnh và kết quả"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <img
                  src={pastedImagePreviewUrl}
                  alt="Ảnh lịch tăng ca vừa tải"
                  className="w-full max-h-36 object-contain rounded-lg border border-slate-200 bg-white"
                />
              </div>
            )}

            {isScanningImage && (
              <div
                role="status"
                data-testid="ai-scan-loading"
                className="rounded-xl border border-blue-200 bg-blue-50/80 p-3 flex items-center gap-2.5 text-xs text-[#14539E]"
              >
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <div>
                  <div className="font-bold">Đang phân tích ảnh bằng Gemini AI...</div>
                  <div className="text-[10px] text-blue-700/80">
                    Đang đối chiếu tên nhân sự, khung giờ và lý do tăng ca
                  </div>
                </div>
              </div>
            )}

            {scanError && (
              <div
                role="alert"
                data-testid="ai-scan-error"
                className="rounded-xl border border-rose-200 bg-rose-50 p-3 flex items-start gap-2 text-xs text-rose-800"
              >
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="leading-snug flex-1">{scanError}</div>
              </div>
            )}

            {!isScanningImage && parsedAiBlocks.length > 0 && (
              <div className="space-y-2.5" data-testid="ai-scan-results">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                  <span>Kết quả AI bóc tách ({parsedAiBlocks.length} nhóm)</span>
                </div>

                {parsedAiBlocks.map((block, idx) => {
                  const onLeaveMap = buildOnLeaveEmployeeMapForDate(
                    block.overtimeDate,
                    effectiveLeaveRecords,
                    employeesList
                  );
                  const { availableParticipants, onLeaveConflicts } =
                    evaluateAiBlockLeaveConflicts({
                      block,
                      employeeMap,
                      onLeaveMap,
                    });
                  const isBusy =
                    isCommittingBlock || committingAiBlockId === block.id;

                  return (
                    <div
                      key={block.id}
                      data-testid={`ai-parsed-block-${idx}`}
                      className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs space-y-2"
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-[10px] font-mono font-bold text-[#14539E]">
                          #{idx + 1} • {formatDateToFormStyle(block.overtimeDate)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-slate-600">
                          <Clock className="w-2.5 h-2.5 text-slate-400" />
                          {block.startTime}-{block.endTime}
                        </span>
                      </div>

                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold text-slate-900 leading-snug break-words">
                          {block.reasonVi}
                        </div>
                        {block.reasonKr && (
                          <div className="text-[11px] text-slate-500 leading-snug break-words">
                            {block.reasonKr}
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="text-[10px] font-bold text-emerald-700 flex items-center justify-between">
                          <span>
                            Khớp nhân sự: {availableParticipants.length}
                            {onLeaveConflicts.length > 0
                              ? ` (${onLeaveConflicts.length} đang nghỉ)`
                              : ''}
                          </span>
                        </div>
                        {availableParticipants.length > 0 && (
                          <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
                            {availableParticipants.map((p) => {
                              const emp = employeeMap.get(p.employeeId);
                              const customTime =
                                p.startTime !== block.startTime ||
                                p.endTime !== block.endTime;
                              return (
                                <span
                                  key={p.employeeId}
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] ${
                                    customTime
                                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                                      : 'bg-slate-50 border-slate-200 text-slate-700'
                                  }`}
                                >
                                  <span className="font-medium truncate max-w-[125px]">
                                    {emp?.fullName || p.rawName}
                                  </span>
                                  <span className="font-mono text-[9px] text-slate-500">
                                    {p.startTime}-{p.endTime}
                                  </span>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {onLeaveConflicts.length > 0 && (
                        <div className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-[10px] text-rose-800 space-y-0.5">
                          <div className="font-bold">
                            Đang có đơn nghỉ (tự bỏ qua):
                          </div>
                          <div>
                            {onLeaveConflicts
                              .map((c) => `${c.fullName} (${c.leaveLabel})`)
                              .join(', ')}
                          </div>
                        </div>
                      )}

                      {block.unmatchedNames.length > 0 && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] text-amber-900 space-y-0.5">
                          <div className="font-bold">
                            Tên chưa khớp hệ thống ({block.unmatchedNames.length}):
                          </div>
                          <div>{block.unmatchedNames.join(', ')}</div>
                        </div>
                      )}

                      <div className="pt-1 flex flex-col gap-1.5">
                        <button
                          type="button"
                          disabled={isLockedForm || isBusy}
                          onClick={() => onApplyAiBlockToForm(block)}
                          className="w-full h-7 px-2.5 rounded-lg border border-[#14539E] bg-white hover:bg-blue-50 text-[#14539E] text-[11px] font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <ArrowRight className="w-3 h-3" />
                          <span>Đưa vào form để kiểm tra</span>
                        </button>
                        <button
                          type="button"
                          disabled={
                            isLockedForm ||
                            isBusy ||
                            availableParticipants.length === 0
                          }
                          onClick={async () => {
                            setCommittingAiBlockId(block.id);
                            try {
                              await onCommitAiBlockImmediately(block);
                            } finally {
                              setCommittingAiBlockId(null);
                            }
                          }}
                          className="w-full h-7 px-2.5 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-[11px] font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isBusy ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3 stroke-[2.5]" />
                          )}
                          <span>Ghi nhận & Lưu ngay vào phiếu</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: LÝ DO MẪU */}
        {activeTab === 'glossary' && (
          <div className="space-y-2.5" data-testid="glossary-tab-panel">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={glossarySearch}
                onChange={(e) => setGlossarySearch(e.target.value)}
                placeholder="Tìm nhanh lý do Việt hoặc Hàn..."
                aria-label="Tìm lý do mẫu"
                className="w-full h-8 pl-8 pr-7 text-xs text-slate-800 placeholder:text-slate-400 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E]"
              />
              {glossarySearch && (
                <button
                  type="button"
                  onClick={() => setGlossarySearch('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                  aria-label="Xóa tìm kiếm lý do"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {filteredGlossaryCards.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
                Không tìm thấy lý do mẫu đã duyệt nào phù hợp.
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredGlossaryCards.map((entry) => {
                  const entryGroups = normalizeTargetGroups(entry.target_groups);
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      disabled={isLockedForm}
                      onClick={() => onSelectGlossaryCard(entry)}
                      className="w-full text-left p-2.5 rounded-xl border border-slate-200 bg-white hover:border-[#14539E] hover:bg-blue-50/40 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed space-y-1 group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-800 group-hover:text-[#14539E] leading-snug break-words">
                          {entry.reasonVi}
                        </span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      </div>
                      <div className="text-[11px] text-slate-500 leading-snug break-words">
                        {entry.reasonKr}
                      </div>
                      {entryGroups.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {entryGroups.map((g) => (
                            <span
                              key={g}
                              className="px-1.5 py-0.5 rounded bg-slate-100 text-[9px] font-semibold text-slate-600"
                            >
                              {g}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ĐÃ GHI NHẬN */}
        {activeTab === 'recorded' && (
          <div className="space-y-2.5" data-testid="recorded-tab-panel">
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-2.5 py-2 flex items-center justify-between text-[11px]">
              <span className="font-bold text-slate-700">
                Tổng cộng ({previewData.length} nhóm)
              </span>
              <span className="font-mono text-slate-600 tabular-nums">
                {summaryStats.datesCount} ngày • {summaryStats.totalParticipants}{' '}
                lượt •{' '}
                <strong className="text-[#14539E]">
                  {formatNumberVN(summaryStats.totalHours)}g
                </strong>
              </span>
            </div>

            {previewData.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center space-y-1.5">
                <p className="text-xs font-semibold text-slate-700">
                  Chưa có nhóm công việc nào được ghi nhận
                </p>
                <p className="text-[11px] text-slate-500">
                  Hãy nhập ở cột Nhập liệu nhanh bên trái hoặc dán ảnh Zalo vào tab Quét ảnh AI.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {previewData.map((b, idx) => {
                  const blockDate =
                    b.overtimeDate || shellOvertimeDate || '';
                  const blockDepts = normalizeTargetGroups(
                    b.selectedEmployeeIds.map(
                      (id) => employeeMap.get(id)?.department || ''
                    )
                  );
                  const blockEval = evaluateOvertimeDaySchedule({
                    isoDate: blockDate,
                    holidays: companyHolidays,
                    shifts: effectiveWorkShifts,
                    departmentName: blockDepts[0] || selectedGroupFilter,
                    employeeDepartments: blockDepts,
                  });
                  const isSundayOrOff =
                    blockEval.dayKind === 'weekly_off' ||
                    blockEval.dayKind === 'holiday' ||
                    blockEval.dayKind === 'compensatory_off' ||
                    (Boolean(
                      blockDate && /^\d{4}-\d{2}-\d{2}$/.test(blockDate)
                    ) &&
                      getWeekdayKeyFromIsoDate(blockDate) === 'sun');
                  const blockCalc = calculateActualOvertimeHours(
                    blockDate,
                    b.startTime,
                    b.endTime,
                    isSundayOrOff,
                    overtimeSettings
                  );

                  return (
                    <div
                      key={b.id}
                      data-testid={`recorded-block-card-${idx}`}
                      className={`p-2.5 rounded-xl border text-xs shadow-2xs transition-colors space-y-1.5 ${
                        editingBlockId === b.id
                          ? 'bg-blue-50/80 border-[#14539E]'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-[#14539E]">
                              #{idx + 1}
                            </span>
                            <span className="font-bold text-slate-800 font-mono text-[11px]">
                              [{formatDateToFormStyle(b.overtimeDate)}]
                            </span>
                          </div>
                          <div className="text-slate-800 font-medium break-words leading-snug mt-0.5">
                            {b.reasonVi || 'Không có lý do'}
                          </div>
                          {b.reasonKr && (
                            <div className="text-[10px] text-slate-500 break-words leading-snug">
                              {b.reasonKr}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            disabled={isLockedForm}
                            onClick={() => onEditBlock(idx)}
                            className="p-1 rounded text-[#14539E] hover:bg-blue-50 cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                            title="Sửa nhóm"
                            aria-label={`Sửa nhóm #${idx + 1}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={isLockedForm || idx === 0}
                            onClick={() => onMoveBlock(idx, 'up')}
                            className="p-1 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                            title="Lên"
                            aria-label={`Chuyển nhóm #${idx + 1} lên`}
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={
                              isLockedForm || idx === previewData.length - 1
                            }
                            onClick={() => onMoveBlock(idx, 'down')}
                            className="p-1 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                            title="Xuống"
                            aria-label={`Chuyển nhóm #${idx + 1} xuống`}
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={isLockedForm}
                            onClick={() => onRemoveBlock(idx)}
                            className="p-1 rounded text-red-500 hover:bg-red-50 cursor-pointer ml-0.5 disabled:opacity-35 disabled:cursor-not-allowed"
                            title="Xóa"
                            aria-label={`Xóa nhóm #${idx + 1}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="text-[10px] text-slate-500 font-mono truncate tabular-nums">
                        {b.selectedEmployeeIds.length} nhân sự
                        {blockDepts.length > 0
                          ? ` • ${blockDepts.join(', ')}`
                          : ''}
                        {' • '}
                        {b.startTime}-{b.endTime} (
                        {formatNumberVN(blockCalc.netHours)}g)
                      </div>

                      {blockCalc.noteText && (
                        <div className="text-[10px] text-amber-700 font-medium truncate">
                          {blockCalc.noteText}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
