import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_COMPANY_DEPARTMENTS,
  generateCompanyDepartmentCode,
  mergeCompanyDepartmentOptions,
  normalizeCompanyDepartmentRow,
  readLocalCompanyDepartments,
  sortCompanyDepartments,
  writeLocalCompanyDepartments,
} from './companyDepartmentsService';

test('DEFAULT_COMPANY_DEPARTMENTS has the 4 standard company departments in order', () => {
  assert.deepEqual(
    DEFAULT_COMPANY_DEPARTMENTS.map((d) => [d.name, d.code, d.sortOrder]),
    [
      ['Kỹ thuật', 'KT', 1],
      ['Sản xuất', 'SX', 2],
      ['QC', 'QC', 3],
      ['Phát triển', 'PT', 4],
    ]
  );
});

test('generateCompanyDepartmentCode builds concise uppercase codes with Vietnamese diacritic stripping', () => {
  assert.equal(generateCompanyDepartmentCode('Kỹ thuật'), 'KT');
  assert.equal(generateCompanyDepartmentCode('Sản xuất'), 'SX');
  assert.equal(generateCompanyDepartmentCode('Phát triển'), 'PT');
  assert.equal(generateCompanyDepartmentCode('Kế hoạch vật tư'), 'KHVT');
  assert.equal(generateCompanyDepartmentCode('QC'), 'QC');
});

test('normalizeCompanyDepartmentRow & sortCompanyDepartments preserve explicit code and sort order', () => {
  const rowA = normalizeCompanyDepartmentRow(
    { id: '1', name: 'Sản xuất', code: 'sx', sort_order: 2 },
    0
  );
  const rowB = normalizeCompanyDepartmentRow(
    { id: '2', name: 'Kỹ thuật', sort_order: 1 },
    1
  );
  const sorted = sortCompanyDepartments([rowA, rowB]);
  assert.deepEqual(
    sorted.map((d) => ({ id: d.id, name: d.name, code: d.code, sortOrder: d.sortOrder })),
    [
      { id: '2', name: 'Kỹ thuật', code: 'KT', sortOrder: 1 },
      { id: '1', name: 'Sản xuất', code: 'SX', sortOrder: 2 },
    ]
  );
});

test('mergeCompanyDepartmentOptions preserves company departments first and appends any legacy request values without duplicates', () => {
  const options = mergeCompanyDepartmentOptions(DEFAULT_COMPANY_DEPARTMENTS, [
    'Sản xuất',
    'Bảo trì',
    '',
    null,
    'QC',
  ]);
  assert.deepEqual(options, [
    'Kỹ thuật',
    'Sản xuất',
    'QC',
    'Phát triển',
    'Bảo trì',
  ]);
});

test('readLocalCompanyDepartments falls back to defaults in non-browser environment', () => {
  const list = readLocalCompanyDepartments();
  assert.equal(list.length, 4);
  assert.equal(list[0].name, 'Kỹ thuật');
  const sorted = writeLocalCompanyDepartments(list, false);
  assert.equal(sorted.length, 4);
});
