/**
 * CRYVEX Compliance Report Generator
 * Generates PDF and CSV reports for blockchain integrity verification results.
 */

const BRAND = {
  name: 'CRYVEX',
  tagline: 'Blockchain-Enabled ETL Pipeline Integrity Verifier',
  primary: [102, 126, 234],    // #667eea
  success: [34, 197, 94],      // #22c55e
  danger: [239, 68, 68],       // #ef4444
  dark: [30, 41, 59],          // #1e293b
  muted: [100, 116, 139],      // #64748b
};

// ─── PDF Report ───────────────────────────────────────────────

export async function generateVerificationPDF({ tableResults, verifiedTables, tableHistory, pipelineName }) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF();
  const now = new Date();
  let y = 15;

  // ── Header ──
  doc.setFillColor(...BRAND.primary);
  doc.rect(0, 0, 210, 42, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('CRYVEX', 14, y + 6);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Blockchain-Enabled ETL Pipeline Integrity Verifier', 14, y + 14);

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Full Dataset Integrity Compliance Report', 14, y + 26);

  // ── Report meta (right side of header) ──
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${now.toLocaleString()}`, 196, y + 6, { align: 'right' });
  doc.text(`Report ID: CRV-${Date.now().toString(36).toUpperCase()}`, 196, y + 12, { align: 'right' });
  if (pipelineName) {
    doc.text(`Pipeline: ${pipelineName}`, 196, y + 18, { align: 'right' });
  }

  y = 52;

  // ── Executive Summary ──
  const tables = verifiedTables || [];
  const results = tableResults || {};
  const verifiedCount = Object.values(results).filter(r => r && r.verified).length;
  const failedCount = Object.values(results).filter(r => r && !r.verified).length;
  const pendingCount = tables.length - verifiedCount - failedCount;
  const overallPass = failedCount === 0 && verifiedCount > 0 && pendingCount === 0;

  doc.setTextColor(...BRAND.dark);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Executive Summary', 14, y);
  y += 8;

  // Status box
  const statusColor = overallPass ? BRAND.success : (failedCount > 0 ? BRAND.danger : BRAND.muted);
  const statusText = overallPass ? 'ALL CHECKS PASSED' : (failedCount > 0 ? 'INTEGRITY ISSUES DETECTED' : 'VERIFICATION PENDING');

  doc.setFillColor(...statusColor);
  doc.roundedRect(14, y, 182, 14, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(statusText, 105, y + 9, { align: 'center' });

  y += 22;

  // Summary stats table
  const totalRows = tables.reduce((sum, t) => sum + (Number(t.latest_row_count) || 0), 0);
  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Value']],
    body: [
      ['Total Tables in Dataset', String(tables.length)],
      ['Tables Verified (Passed)', String(verifiedCount)],
      ['Tables Failed', String(failedCount)],
      ['Tables Pending Verification', String(pendingCount)],
      ['Total Rows Protected by Blockchain', totalRows.toLocaleString()],
      ['Report Generated', now.toLocaleString()],
      ['Report ID', `CRV-${Date.now().toString(36).toUpperCase()}`],
    ],
    theme: 'grid',
    headStyles: { fillColor: BRAND.primary, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 } },
    margin: { left: 14, right: 14 },
  });

  y = doc.lastAutoTable.finalY + 12;

  // ── Table Verification Details ──
  if (y > 240) { doc.addPage(); y = 20; }

  doc.setTextColor(...BRAND.dark);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Table Verification Details', 14, y);
  y += 8;

  const detailRows = tables.map(table => {
    const r = results[table.table_name];
    return [
      table.table_name,
      r ? (r.verified ? 'PASSED' : 'FAILED') : 'PENDING',
      String(table.latest_row_count || 0),
      String(table.run_count || 0),
      r?.merkle_root ? truncate(r.merkle_root, 22) : '-',
      r?.blockchain_root ? truncate(r.blockchain_root, 22) : '-',
      r ? (r.roots_match ? 'Yes' : 'No') : '-',
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['Table', 'Status', 'Rows', 'Runs', 'DB Merkle Root', 'Blockchain Root', 'Match']],
    body: detailRows,
    theme: 'grid',
    headStyles: { fillColor: BRAND.primary, fontSize: 7.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 30 },
      1: { cellWidth: 17 },
      2: { cellWidth: 14, halign: 'center' },
      3: { cellWidth: 13, halign: 'center' },
      4: { cellWidth: 38, font: 'courier' },
      5: { cellWidth: 38, font: 'courier' },
      6: { cellWidth: 14, halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.column.index === 1 && data.section === 'body') {
        if (data.cell.raw === 'PASSED') {
          data.cell.styles.textColor = BRAND.success;
          data.cell.styles.fontStyle = 'bold';
        } else if (data.cell.raw === 'FAILED') {
          data.cell.styles.textColor = BRAND.danger;
          data.cell.styles.fontStyle = 'bold';
        }
      }
      if (data.column.index === 6 && data.section === 'body') {
        if (data.cell.raw === 'No') {
          data.cell.styles.textColor = BRAND.danger;
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  y = doc.lastAutoTable.finalY + 12;

  // ── Root History (if available) ──
  const tablesWithHistory = Object.entries(tableHistory || {}).filter(
    ([, h]) => h?.history?.length > 0
  );

  if (tablesWithHistory.length > 0) {
    if (y > 230) { doc.addPage(); y = 20; }

    doc.setTextColor(...BRAND.dark);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Merkle Root History', 14, y);
    y += 8;

    for (const [tableName, histData] of tablesWithHistory) {
      if (y > 250) { doc.addPage(); y = 20; }

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...BRAND.dark);
      doc.text(`Table: ${tableName}  (${histData.total_runs} total runs)`, 14, y);
      y += 5;

      const histRows = histData.history.slice().reverse().slice(0, 10).map(entry => [
        `#${entry.run}`,
        truncate(entry.merkle_root, 32),
        String(entry.row_count),
        entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '-',
      ]);

      autoTable(doc, {
        startY: y,
        head: [['Run', 'Merkle Root', 'Rows', 'Timestamp']],
        body: histRows,
        theme: 'grid',
        headStyles: { fillColor: BRAND.primary, fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 15 },
          1: { cellWidth: 70, font: 'courier' },
          2: { cellWidth: 20, halign: 'center' },
        },
        margin: { left: 14, right: 14 },
      });

      y = doc.lastAutoTable.finalY + 8;
    }
  }

  // ── Footer on every page ──
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...BRAND.muted);
    doc.text(
      `CRYVEX Compliance Report  |  Generated ${now.toLocaleString()}  |  Page ${i} of ${totalPages}`,
      105, 290, { align: 'center' }
    );
    // Divider line above footer
    doc.setDrawColor(...BRAND.muted);
    doc.setLineWidth(0.3);
    doc.line(14, 286, 196, 286);
  }

  // Save
  const filename = `CRYVEX_Full_Dataset_Integrity_Report_${formatFileDate(now)}.pdf`;
  doc.save(filename);
  return filename;
}


// ─── CSV Export ───────────────────────────────────────────────

export function generateVerificationCSV({ tableResults, verifiedTables, tableHistory }) {
  const now = new Date();
  const results = tableResults || {};
  const tables = verifiedTables || [];

  const rows = [
    ['CRYVEX Data Integrity Compliance Report'],
    [`Generated: ${now.toISOString()}`],
    [],
    ['Table Name', 'Status', 'Row Count', 'Verification Runs', 'DB Merkle Root', 'Blockchain Root', 'Roots Match', 'TX Hash', 'Last Verified'],
  ];

  for (const table of tables) {
    const r = results[table.table_name];
    rows.push([
      table.table_name,
      r ? (r.verified ? 'PASSED' : 'FAILED') : 'PENDING',
      table.latest_row_count || 0,
      table.run_count || 0,
      r?.merkle_root || '',
      r?.blockchain_root || '',
      r ? (r.roots_match ? 'Yes' : 'No') : '',
      r?.tx_hash || '',
      table.last_run || '',
    ]);
  }

  // Root history section
  const histEntries = Object.entries(tableHistory || {});
  if (histEntries.some(([, h]) => h?.history?.length > 0)) {
    rows.push([]);
    rows.push(['--- Root History ---']);
    rows.push(['Table', 'Run #', 'Merkle Root', 'Row Count', 'Timestamp']);

    for (const [tableName, histData] of histEntries) {
      if (!histData?.history) continue;
      for (const entry of histData.history) {
        rows.push([
          tableName,
          entry.run,
          entry.merkle_root || '',
          entry.row_count,
          entry.timestamp || '',
        ]);
      }
    }
  }

  const csv = rows.map(row => row.map(cell => csvEscape(String(cell))).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `CRYVEX_Full_Dataset_Integrity_${formatFileDate(now)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}


// ─── Pipeline Verification Report (from modal data) ──────────

export async function generatePipelineVerificationPDF({ verification, auditTables = [] }) {
  if (!verification) return;

  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF();
  const now = new Date();
  let y = 15;

  // Header
  doc.setFillColor(...BRAND.primary);
  doc.rect(0, 0, 210, 38, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('CRYVEX', 14, y + 5);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Blockchain-Enabled ETL Pipeline Integrity Verifier', 14, y + 13);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`Full Dataset Integrity Report — ${verification.config_name || 'Pipeline'}`, 14, y + 23);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${now.toLocaleString()}`, 196, y + 5, { align: 'right' });

  y = 48;

  // Status
  const isSuccess = verification.status === 'success';
  const statusColor = isSuccess ? BRAND.success : BRAND.danger;
  const statusLabel = isSuccess ? 'VERIFICATION PASSED' : 'VERIFICATION FAILED';

  doc.setFillColor(...statusColor);
  doc.roundedRect(14, y, 182, 12, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(statusLabel, 105, y + 8, { align: 'center' });
  y += 20;

  // Execution info — use audit table count when Airflow task data has no per-table breakdown
  const taskProgress = verification.task_progress ? JSON.parse(verification.task_progress) : null;
  const totalTables = (taskProgress?.total > 0 ? taskProgress.total : null) ?? auditTables.length;
  const verifiedCount = (taskProgress?.total > 0 ? taskProgress.completed : null) ?? (isSuccess ? auditTables.length : 0);
  const failedCount = (taskProgress?.total > 0 ? taskProgress.failed : null) ?? (isSuccess ? 0 : auditTables.length);

  autoTable(doc, {
    startY: y,
    head: [['Field', 'Value']],
    body: [
      ['Pipeline', verification.config_name || '-'],
      ['Status', isSuccess ? 'success' : verification.status],
      ['DAG ID', verification.airflow_dag_id || '-'],
      ['Run ID', verification.airflow_run_id || '-'],
      ['Started', verification.started_at ? new Date(verification.started_at).toLocaleString() : '-'],
      ['Completed', verification.completed_at ? new Date(verification.completed_at).toLocaleString() : '-'],
      ['Total Tables', String(totalTables)],
      ['Verified', String(verifiedCount)],
      ['Failed', String(failedCount)],
    ],
    theme: 'grid',
    headStyles: { fillColor: BRAND.primary, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 } },
    margin: { left: 14, right: 14 },
  });

  y = doc.lastAutoTable.finalY + 12;

  // ── Table-by-Table Verification Status ──
  // The Airflow DAG may run as a single "verification" task (not per-table tasks).
  // In that case fall back to the merkle_audit table list (auditTables) and mark
  // every table as VERIFIED when the overall pipeline status is success.
  const tasks = verification.tasks || [];
  const tableTasks = tasks.filter(t => t.task_id && t.task_id.startsWith('verify_'));

  // Build the per-table rows — prefer Airflow per-task data, fall back to audit list
  let tableRows = [];
  if (tableTasks.length > 0) {
    tableRows = tableTasks.map((t, idx) => {
      const tableName = t.task_id.replace(/^verify_/, '');
      const status = t.state === 'success' ? 'VERIFIED' : t.state === 'failed' ? 'FAILED' : t.state?.toUpperCase() || '-';
      const duration = t.duration
        ? (t.duration < 1 ? `${(t.duration * 1000).toFixed(0)} ms` : `${t.duration.toFixed(2)} s`)
        : '-';
      return [String(idx + 1), tableName, String(t.latest_row_count || '-'), status, duration];
    });
  } else if (auditTables.length > 0) {
    // Single-task DAG: use merkle_audit data; status = overall pipeline status
    tableRows = auditTables.map((tbl, idx) => {
      const status = isSuccess ? 'VERIFIED' : 'FAILED';
      const rowCount = tbl.latest_row_count != null ? String(tbl.latest_row_count) : '-';
      return [String(idx + 1), tbl.table_name, rowCount, status, '-'];
    });
  }

  if (tableRows.length > 0) {
    if (y > 220) { doc.addPage(); y = 20; }

    doc.setTextColor(...BRAND.dark);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Table Verification Status', 14, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [['#', 'Table Name', 'Rows', 'Status', 'Duration']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: BRAND.primary, fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 82, fontStyle: 'bold' },
        2: { cellWidth: 22, halign: 'center' },
        3: { cellWidth: 38, halign: 'center' },
        4: { cellWidth: 24, halign: 'center' },
      },
      didParseCell: (data) => {
        if (data.column.index === 3 && data.section === 'body') {
          if (data.cell.raw === 'VERIFIED') {
            data.cell.styles.textColor = BRAND.success;
            data.cell.styles.fontStyle = 'bold';
          } else if (data.cell.raw === 'FAILED') {
            data.cell.styles.textColor = BRAND.danger;
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
      margin: { left: 14, right: 14 },
    });

    y = doc.lastAutoTable.finalY + 12;
  }

  // Error message
  if (verification.error_message) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setTextColor(...BRAND.danger);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Error Details', 14, y);
    y += 6;

    doc.setFontSize(8);
    doc.setFont('courier', 'normal');
    doc.setTextColor(...BRAND.dark);
    const errorLines = doc.splitTextToSize(verification.error_message, 180);
    doc.text(errorLines.slice(0, 30), 14, y);
  }

  // Footer
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...BRAND.muted);
    doc.text(
      `CRYVEX Dataset Integrity Report  |  ${now.toLocaleString()}  |  Page ${i} of ${totalPages}`,
      105, 290, { align: 'center' }
    );
    doc.setDrawColor(...BRAND.muted);
    doc.setLineWidth(0.3);
    doc.line(14, 286, 196, 286);
  }

  const filename = `CRYVEX_Dataset_Integrity_Report_${(verification.config_name || 'unknown').replace(/\s+/g, '_')}_${formatFileDate(now)}.pdf`;
  doc.save(filename.replace(/\s+/g, '_'));
}


// ─── Helpers ──────────────────────────────────────────────────

function truncate(str, len) {
  if (!str) return '-';
  if (str.length <= len) return str;
  return str.slice(0, len - 3) + '...';
}

function csvEscape(val) {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function formatFileDate(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}
