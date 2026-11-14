import Dexie, { type EntityTable } from 'dexie';
import type {
  AttendanceLog,
  AuditLogEntry,
  Employee,
  LeaveOrVacation,
  ScaleTemplate,
  ScheduleAssignment,
  Sector,
  ShiftDefinition,
  ShiftSwapRecord,
  SyncQueueItem,
  UnionRule
} from '../types/domain';

export class EscalaProDatabase extends Dexie {
  employees!: EntityTable<Employee, 'id'>;
  sectors!: EntityTable<Sector, 'id'>;
  scaleTemplates!: EntityTable<ScaleTemplate, 'id'>;
  shifts!: EntityTable<ShiftDefinition, 'id'>;
  scheduleAssignments!: EntityTable<ScheduleAssignment, 'id'>;
  leavesAndVacations!: EntityTable<LeaveOrVacation, 'id'>;
  shiftSwaps!: EntityTable<ShiftSwapRecord, 'id'>;
  attendanceLogs!: EntityTable<AttendanceLog, 'id'>;
  unionRules!: EntityTable<UnionRule, 'id'>;
  auditLogs!: EntityTable<AuditLogEntry, 'id'>;
  syncQueue!: EntityTable<SyncQueueItem, 'id'>;

  constructor(dbName = 'EscalaProCLT_v2') {
    super(dbName);
    this.version(1).stores({
      employees: 'id, registration, sectorId, scaleCode, regime, gender, active',
      sectors: 'id, name, isCommerce',
      scaleTemplates: 'id, code, requiresUnionAgreement',
      shifts: 'id, code',
      scheduleAssignments: 'id, [sectorId+date], [employeeId+date], employeeId, sectorId, date, statusCode',
      leavesAndVacations: 'id, [sectorId+date], [employeeId+date], employeeId, sectorId, date, type',
      shiftSwaps: 'id, date, sectorId, absentEmployeeId, substituteEmployeeId',
      attendanceLogs: 'id, [employeeId+month], employeeId, month, date',
      unionRules: 'id, instrumentType, code',
      auditLogs: 'id, timestamp, entity, entityId, action',
      syncQueue: 'id, status, entity, entityId, createdAt'
    });
  }
}

export const db = new EscalaProDatabase();

