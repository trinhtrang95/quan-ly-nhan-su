import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AttendanceSymbol,
  DEFAULT_ATTENDANCE_SYMBOLS,
  getLeaveCategorySymbols,
  resolveSymbolByCode,
  resolveSymbolForLeaveRecord,
  sortAttendanceSymbols,
} from '../utils/attendanceSymbolsLogic';
import {
  applyRealtimeAttendanceSymbolPayload,
  AttendanceSymbolUpsertInput,
  deleteAttendanceSymbol,
  fetchAttendanceSymbols,
  readLocalAttendanceSymbols,
  subscribeToAttendanceSymbolsRealtime,
  upsertAttendanceSymbol,
} from '../utils/attendanceSymbolsService';
import { LeaveRecord } from '../types/hr';

export interface AttendanceSymbolsContextValue {
  symbols: AttendanceSymbol[];
  leaveSymbols: AttendanceSymbol[];
  isLoading: boolean;
  isSaving: boolean;
  schemaNeedsMigration: boolean;
  refreshSymbols: (silent?: boolean) => Promise<void>;
  saveSymbol: (
    input: AttendanceSymbolUpsertInput
  ) => Promise<{
    savedSymbol: AttendanceSymbol;
    source: 'supabase' | 'local';
    schemaNeedsMigration: boolean;
  }>;
  removeSymbol: (symbolId: string) => Promise<{
    source: 'supabase' | 'local';
    schemaNeedsMigration: boolean;
  }>;
  getSymbolByCode: (code?: string | null) => AttendanceSymbol | undefined;
  getSymbolForRecord: (
    record: Pick<LeaveRecord, 'type' | 'symbolCode'>
  ) => AttendanceSymbol;
}

const defaultFallbackSymbols = sortAttendanceSymbols(DEFAULT_ATTENDANCE_SYMBOLS);

const AttendanceSymbolsContext = createContext<AttendanceSymbolsContextValue>({
  symbols: defaultFallbackSymbols,
  leaveSymbols: getLeaveCategorySymbols(defaultFallbackSymbols),
  isLoading: false,
  isSaving: false,
  schemaNeedsMigration: false,
  refreshSymbols: async () => undefined,
  saveSymbol: async (input) => ({
    savedSymbol: {
      ...input,
      id: input.id || 'fallback',
      sortOrder: input.sortOrder ?? 99,
    },
    source: 'local',
    schemaNeedsMigration: false,
  }),
  removeSymbol: async () => ({ source: 'local', schemaNeedsMigration: false }),
  getSymbolByCode: (code) => resolveSymbolByCode(defaultFallbackSymbols, code),
  getSymbolForRecord: (record) =>
    resolveSymbolForLeaveRecord(defaultFallbackSymbols, record),
});

export const AttendanceSymbolsProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [symbols, setSymbols] = useState<AttendanceSymbol[]>(() =>
    readLocalAttendanceSymbols()
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [schemaNeedsMigration, setSchemaNeedsMigration] =
    useState<boolean>(false);

  const refreshSymbols = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await fetchAttendanceSymbols();
      setSymbols(res.symbols);
      setSchemaNeedsMigration(res.schemaNeedsMigration);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSymbols(false);

    const unsubscribe = subscribeToAttendanceSymbolsRealtime((event) => {
      setSymbols((prev) => applyRealtimeAttendanceSymbolPayload(prev, event));
    });

    return () => {
      unsubscribe();
    };
  }, [refreshSymbols]);

  const saveSymbol = useCallback(
    async (input: AttendanceSymbolUpsertInput) => {
      setIsSaving(true);
      try {
        const res = await upsertAttendanceSymbol(input, symbols);
        setSymbols(res.symbols);
        if (res.schemaNeedsMigration) {
          setSchemaNeedsMigration(true);
        }
        return {
          savedSymbol: res.savedSymbol,
          source: res.source,
          schemaNeedsMigration: res.schemaNeedsMigration,
        };
      } finally {
        setIsSaving(false);
      }
    },
    [symbols]
  );

  const removeSymbol = useCallback(
    async (symbolId: string) => {
      setIsSaving(true);
      try {
        const res = await deleteAttendanceSymbol(symbolId, symbols);
        setSymbols(res.symbols);
        if (res.schemaNeedsMigration) {
          setSchemaNeedsMigration(true);
        }
        return {
          source: res.source,
          schemaNeedsMigration: res.schemaNeedsMigration,
        };
      } finally {
        setIsSaving(false);
      }
    },
    [symbols]
  );

  const leaveSymbols = useMemo(
    () => getLeaveCategorySymbols(symbols),
    [symbols]
  );

  const getSymbolByCode = useCallback(
    (code?: string | null) => resolveSymbolByCode(symbols, code),
    [symbols]
  );

  const getSymbolForRecord = useCallback(
    (record: Pick<LeaveRecord, 'type' | 'symbolCode'>) =>
      resolveSymbolForLeaveRecord(symbols, record),
    [symbols]
  );

  const value = useMemo<AttendanceSymbolsContextValue>(
    () => ({
      symbols,
      leaveSymbols,
      isLoading,
      isSaving,
      schemaNeedsMigration,
      refreshSymbols,
      saveSymbol,
      removeSymbol,
      getSymbolByCode,
      getSymbolForRecord,
    }),
    [
      symbols,
      leaveSymbols,
      isLoading,
      isSaving,
      schemaNeedsMigration,
      refreshSymbols,
      saveSymbol,
      removeSymbol,
      getSymbolByCode,
      getSymbolForRecord,
    ]
  );

  return (
    <AttendanceSymbolsContext.Provider value={value}>
      {children}
    </AttendanceSymbolsContext.Provider>
  );
};

export function useAttendanceSymbols(): AttendanceSymbolsContextValue {
  return useContext(AttendanceSymbolsContext);
}
