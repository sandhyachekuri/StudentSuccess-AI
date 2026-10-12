import React, { useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  AlertOctagon,
  CheckCircle2,
  Download,
  RotateCcw,
  FileWarning,
  Check,
  X,
} from 'lucide-react';
import { CSVParseResult, RiskThresholds, StudentRecord } from '../types/student';
import {
  generateSampleCSVTemplate,
  REQUIRED_CSV_COLUMNS,
  validateAndParseStudentCSV,
} from '../utils/csvParser';
import { enrichStudentDataset } from '../engine/analyticsEngine';
import { RiskLevelIndicator } from './StudentProfileModal';
import {
  BackendConnectionState,
  uploadCsvViaBackend,
} from '../services/apiClient';

interface CSVImportViewProps {
  activeRecordCount: number;
  isUsingCustomDataset: boolean;
  thresholds: RiskThresholds;
  onReplaceDataset: (records: StudentRecord[]) => void;
  onMergeDataset: (records: StudentRecord[]) => void;
  onRestoreDefaultDataset: () => void;
  apiBaseUrl?: string;
  backendConnectionState?: BackendConnectionState;
}

export const CSVImportView: React.FC<CSVImportViewProps> = ({
  activeRecordCount,
  isUsingCustomDataset,
  thresholds,
  onReplaceDataset,
  onMergeDataset,
  onRestoreDefaultDataset,
  apiBaseUrl,
  backendConnectionState = 'untested',
}) => {
  const [fileName, setFileName] = useState<string>('');
  const [parseResult, setParseResult] = useState<CSVParseResult | null>(null);
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const [isUploadingToBackend, setIsUploadingToBackend] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setStatusBanner(null);

    // If FastAPI backend is connected, validate via POST /api/upload-csv first with graceful fallback
    if (backendConnectionState === 'connected') {
      setIsUploadingToBackend(true);
      try {
        const backendResp = await uploadCsvViaBackend(file, false, apiBaseUrl);
        const mappedResult: CSVParseResult = {
          isValidStructure: backendResp.isValidStructure,
          missingColumns: backendResp.missingColumns,
          validRecords: backendResp.validRecords,
          errors: backendResp.errors,
          totalRowsRead: backendResp.totalRowsRead,
        };
        setParseResult(mappedResult);
        setIsUploadingToBackend(false);

        if (!mappedResult.isValidStructure || mappedResult.validRecords.length === 0) {
          setStatusBanner({
            type: 'error',
            message: `FastAPI POST /api/upload-csv validation failed: ${
              mappedResult.missingColumns.length > 0
                ? `Missing required columns (${mappedResult.missingColumns.join(', ')})`
                : 'No valid student rows found.'
            }. The active dataset was not modified.`,
          });
        } else {
          setStatusBanner({
            type: 'info',
            message: `Validated "${file.name}" via FastAPI POST /api/upload-csv (${mappedResult.validRecords.length} valid, ${mappedResult.errors.length} invalid rows). Confirm below to import.`,
          });
        }
        return;
      } catch {
        setIsUploadingToBackend(false);
      }
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result || '');
      const result = validateAndParseStudentCSV(content);
      setParseResult(result);

      if (!result.isValidStructure || result.validRecords.length === 0) {
        setStatusBanner({
          type: 'error',
          message: `CSV validation failed: ${
            result.missingColumns.length > 0
              ? `Missing required columns (${result.missingColumns.join(', ')})`
              : 'No valid student rows found.'
          }. The active dataset was not modified.`,
        });
      }
    };
    reader.onerror = () => {
      setStatusBanner({
        type: 'error',
        message: 'Failed to read the selected file. Please upload a valid UTF-8 CSV file.',
      });
    };
    reader.readAsText(file);
  };

  const handleLoadSampleInBrowser = (withErrors: boolean) => {
    const sampleText = generateSampleCSVTemplate(withErrors);
    const label = withErrors
      ? 'sample_cohort_with_validation_errors.csv'
      : 'sample_valid_cohort_5_students.csv';
    setFileName(label);
    const result = validateAndParseStudentCSV(sampleText);
    setParseResult(result);
    setStatusBanner({
      type: 'info',
      message: `Loaded "${label}" for preview. Inspect the validation report below and confirm before importing.`,
    });
  };

  const handleDownloadSampleCSV = () => {
    const csv = generateSampleCSVTemplate(false);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'studentsuccess_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleConfirmImport = () => {
    if (!parseResult || !parseResult.isValidStructure || parseResult.validRecords.length === 0) {
      setStatusBanner({
        type: 'error',
        message: 'Import aborted: Cannot import when there are 0 valid records.',
      });
      return;
    }

    if (importMode === 'replace') {
      onReplaceDataset(parseResult.validRecords);
      setStatusBanner({
        type: 'success',
        message: `Imported ${parseResult.validRecords.length} validated student records (Replaced active dataset). All KPIs, charts, and directory filters are now updated.`,
      });
    } else {
      onMergeDataset(parseResult.validRecords);
      setStatusBanner({
        type: 'success',
        message: `Merged ${parseResult.validRecords.length} validated student records into the active campus dataset. All KPIs, charts, and directory views are now updated.`,
      });
    }
    setParseResult(null);
    setFileName('');
  };

  const previewEnriched = React.useMemo(() => {
    if (!parseResult || parseResult.validRecords.length === 0) return [];
    return enrichStudentDataset(parseResult.validRecords, thresholds);
  }, [parseResult, thresholds]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            CSV Dataset Import & Schema Validation
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Upload institutional student records in CSV format. Every column and numeric range is validated before preview and confirmation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={handleDownloadSampleCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV Template</span>
          </button>

          {isUsingCustomDataset && (
            <button
              onClick={() => {
                onRestoreDefaultDataset();
                setParseResult(null);
                setStatusBanner({
                  type: 'info',
                  message:
                    'Restored the built-in 56-student deterministic synthetic dataset.',
                });
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore Built-In 56 Synthetic Records</span>
            </button>
          )}
        </div>
      </div>

      {/* Status Notification Banner */}
      {statusBanner && (
        <div
          className={`p-4 rounded-xl border flex items-start justify-between gap-3 text-xs ${
            statusBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : statusBanner.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-900'
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {statusBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : statusBanner.type === 'error' ? (
              <AlertOctagon className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            )}
            <span className="font-medium leading-relaxed">{statusBanner.message}</span>
          </div>
          <button
            onClick={() => setStatusBanner(null)}
            className="text-slate-500 hover:text-slate-900"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upload Dropzone & Instant Test Loaders */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">1. Select or Upload CSV File</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Active Dataset currently holds{' '}
              <strong className="font-mono text-slate-900">{activeRecordCount}</strong> student
              records ({isUsingCustomDataset ? 'Custom Imported Dataset' : 'Built-In Synthetic Cohort'}).
            </p>
          </div>

          <label className="border-2 border-dashed border-slate-300 hover:border-blue-600 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-50/60 hover:bg-blue-50/30 block">
            <Upload className="w-7 h-7 text-blue-600 mx-auto mb-2" />
            <div className="text-xs font-bold text-slate-900">
              {isUploadingToBackend
                ? 'Validating CSV via FastAPI POST /api/upload-csv...'
                : fileName
                ? `Selected: ${fileName}`
                : 'Click to Browse a .CSV File from Your Device'}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Validates all 15 required columns and numeric ranges before any data is imported
            </div>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-slate-500">Quick Interactive Demo Presets:</span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleLoadSampleInBrowser(false)}
                className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              >
                Load Valid 5-Student Sample
              </button>
              <button
                type="button"
                onClick={() => handleLoadSampleInBrowser(true)}
                className="px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
              >
                Test Row Validation Errors
              </button>
            </div>
          </div>
        </div>

        {/* Visible Required CSV Columns Specification */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              2. Required CSV Columns & Range Rules (15 Fields)
            </h2>
            <p className="text-xs text-slate-500">
              Your CSV header row must include these 15 column names (case-insensitive):
            </p>
          </div>

          <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                <tr>
                  <th className="py-2 px-3">Required Column Header</th>
                  <th className="py-2 px-3">Description</th>
                  <th className="py-2 px-3">Allowed Range</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {REQUIRED_CSV_COLUMNS.map((col) => (
                  <tr key={col.key}>
                    <td className="py-1.5 px-3 font-mono font-semibold text-blue-700">
                      {col.header}
                    </td>
                    <td className="py-1.5 px-3 text-slate-700">{col.description}</td>
                    <td className="py-1.5 px-3 font-mono text-[11px] text-slate-500">
                      {col.validRange}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Validation Results & Preview Confirmation Section */}
      {parseResult && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                3. Validation Report & Pre-Import Preview ({fileName})
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Total data rows scanned: <strong className="font-mono">{parseResult.totalRowsRead}</strong> · Valid
                records ready:{' '}
                <strong className="font-mono text-emerald-700">
                  {parseResult.validRecords.length}
                </strong>{' '}
                · Validation errors:{' '}
                <strong className="font-mono text-red-600">{parseResult.errors.length}</strong>
              </p>
            </div>

            {parseResult.isValidStructure && parseResult.validRecords.length > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs">
                  <button
                    type="button"
                    onClick={() => setImportMode('replace')}
                    className={`px-3 py-1.5 font-medium rounded-md transition-colors ${
                      importMode === 'replace'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Replace Active Dataset
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode('merge')}
                    className={`px-3 py-1.5 font-medium rounded-md transition-colors ${
                      importMode === 'merge'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Merge / Append Records
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleConfirmImport}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    Confirm & Import {parseResult.validRecords.length} Valid Record
                    {parseResult.validRecords.length === 1 ? '' : 's'}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Error Report Table (if any invalid rows or missing columns) */}
          {parseResult.errors.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-red-700">
                <FileWarning className="w-4 h-4 text-red-600" />
                <span>
                  Row-Level Validation Errors ({parseResult.errors.length} issue
                  {parseResult.errors.length === 1 ? '' : 's'} rejected):
                </span>
              </div>
              <div className="border border-red-200 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-red-50 border-b border-red-200 text-[11px] font-semibold text-red-900">
                    <tr>
                      <th className="py-2 px-3">CSV Row #</th>
                      <th className="py-2 px-3">Student ID</th>
                      <th className="py-2 px-3">Field / Column</th>
                      <th className="py-2 px-3">Invalid Value</th>
                      <th className="py-2 px-3">Validation Error Explanation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100 bg-white">
                    {parseResult.errors.map((err, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 font-mono font-semibold text-slate-800">
                          Row {err.rowNumber}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-700">{err.studentId}</td>
                        <td className="py-2 px-3 font-mono text-red-700">{err.field}</td>
                        <td className="py-2 px-3 font-mono text-slate-900">{err.value}</td>
                        <td className="py-2 px-3 text-red-800">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Valid Records Pre-Import Preview Table */}
          {previewEnriched.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-900">
                Preview of Validated Records Ready for Import ({previewEnriched.length}):
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                    <tr>
                      <th className="py-2.5 px-3">Student ID</th>
                      <th className="py-2.5 px-3">Name</th>
                      <th className="py-2.5 px-3">Department</th>
                      <th className="py-2.5 px-3 text-right">CGPA</th>
                      <th className="py-2.5 px-3 text-right">Backlogs</th>
                      <th className="py-2.5 px-3 text-right">Attendance</th>
                      <th className="py-2.5 px-3 text-right">Calculated Score</th>
                      <th className="py-2.5 px-3">Academic Risk</th>
                      <th className="py-2.5 px-3">Placement Risk</th>
                      <th className="py-2.5 px-3">Assigned Segment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {previewEnriched.map((s) => (
                      <tr key={s.studentId} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono font-semibold text-slate-900">
                          {s.studentId}
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-900">{s.name}</td>
                        <td className="py-2 px-3 text-slate-600">{s.department}</td>
                        <td className="py-2 px-3 text-right font-mono">{s.cgpa.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-mono">{s.backlogs}</td>
                        <td className="py-2 px-3 text-right font-mono">{s.attendance}%</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-blue-600">
                          {s.scoreBreakdown.overallScore.toFixed(1)}
                        </td>
                        <td className="py-2 px-3">
                          <RiskLevelIndicator level={s.academicRisk.level} />
                        </td>
                        <td className="py-2 px-3">
                          <RiskLevelIndicator level={s.placementRisk.level} />
                        </td>
                        <td className="py-2 px-3 text-slate-700">{s.segment.label}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
