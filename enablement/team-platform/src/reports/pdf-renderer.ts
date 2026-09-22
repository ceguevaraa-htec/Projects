import PDFDocument from "pdfkit";
import type {
  EmployeeReportData,
  OrgReportData,
  ProjectReportData,
} from "../domain/reports.service.js";

/**
 * Thin pdfkit rendering layer (SDP ADR-0006). Takes data already assembled by
 * reports.service.ts and produces a PDF buffer — no querying, no aggregation, no repository
 * imports (verified by tasks.md T030's grep check). Intentionally minimal formatting, per the
 * PRD's own flagged "report scope creep" risk.
 */

function renderToBuffer(build: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    build(doc);
    doc.end();
  });
}

export function renderOrgReport(data: OrgReportData): Promise<Buffer> {
  return renderToBuffer((doc) => {
    doc.fontSize(18).text("Team Allocation Platform — Org-Wide Report", { underline: true });
    doc.moveDown();

    for (const employee of data.employees) {
      doc
        .fontSize(12)
        .text(
          `${employee.name} (${employee.seniority}) — ${employee.currentUtilizationPercent}% utilized`,
        );
      if (employee.currentAssignments.length === 0) {
        doc.fontSize(10).text("  No current assignments.");
      } else {
        for (const assignment of employee.currentAssignments) {
          doc
            .fontSize(10)
            .text(
              `  ${assignment.projectName} — ${assignment.roleName} (${assignment.capacityPercent}%)`,
            );
        }
      }
      doc.moveDown(0.5);
    }
  });
}

export function renderEmployeeReport(data: EmployeeReportData): Promise<Buffer> {
  return renderToBuffer((doc) => {
    doc.fontSize(18).text(`Employee Report — ${data.name}`, { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(`Seniority: ${data.seniority}`);
    doc.fontSize(12).text(`Current utilization: ${data.currentUtilizationPercent}%`);
    doc.moveDown();

    doc.fontSize(14).text("Assignment History");
    if (data.assignments.length === 0) {
      doc.fontSize(10).text("No assignments.");
    } else {
      for (const assignment of data.assignments) {
        doc
          .fontSize(10)
          .text(
            `${assignment.projectName} — ${assignment.roleName} (${assignment.capacityPercent}%), ` +
              `${assignment.startDate} to ${assignment.endDate} [${assignment.temporalStatus}]`,
          );
      }
    }
  });
}

export function renderProjectReport(data: ProjectReportData): Promise<Buffer> {
  return renderToBuffer((doc) => {
    doc.fontSize(18).text(`Project Report — ${data.name}`, { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(`Status: ${data.status}`);
    doc.fontSize(12).text(`Dates: ${data.startDate} to ${data.endDate}`);
    doc.moveDown();

    doc.fontSize(14).text("Required Roles — Current Staffing");
    for (const role of data.roles) {
      doc.fontSize(12).text(`${role.roleName} (target ${role.capacityPercent}%)`);
      if (role.assignedEmployees.length === 0) {
        doc.fontSize(10).text("  Unstaffed.");
      } else {
        for (const assigned of role.assignedEmployees) {
          doc.fontSize(10).text(`  ${assigned.employeeName} (${assigned.capacityPercent}%)`);
        }
      }
      doc.moveDown(0.5);
    }
  });
}
