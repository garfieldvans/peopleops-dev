import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { PayrollPayslipDetail } from "@peopleops/shared-types";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;

interface PdfContext {
  doc: PDFDocument;
  page: PDFPage;
  regular: PDFFont;
  bold: PDFFont;
  y: number;
}

function formatAmount(value: string, currency: string): string {
  const numeric = Number(value);
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numeric) ? numeric : 0);
  return `${currency} ${formatted}`;
}

function text(
  ctx: PdfContext,
  value: string,
  options: { x?: number; size?: number; bold?: boolean; color?: ReturnType<typeof rgb> } = {},
): void {
  ctx.page.drawText(value, {
    x: options.x ?? MARGIN,
    y: ctx.y,
    size: options.size ?? 10,
    font: options.bold ? ctx.bold : ctx.regular,
    color: options.color ?? rgb(0.1, 0.12, 0.16),
  });
}

function addPage(ctx: PdfContext): void {
  ctx.page = ctx.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  ctx.y = PAGE_HEIGHT - MARGIN;
}

function ensureSpace(ctx: PdfContext, needed: number): void {
  if (ctx.y - needed < 70) {
    addPage(ctx);
  }
}

function row(
  ctx: PdfContext,
  label: string,
  value: string,
  options: { bold?: boolean; indent?: number; muted?: boolean } = {},
): void {
  ensureSpace(ctx, 18);
  ctx.y -= 16;
  text(ctx, label, {
    x: MARGIN + (options.indent ?? 0),
    bold: options.bold,
    color: options.muted ? rgb(0.42, 0.46, 0.52) : undefined,
  });
  ctx.page.drawText(value, {
    x: PAGE_WIDTH - MARGIN - ctx.regular.widthOfTextAtSize(value, 10),
    y: ctx.y,
    size: 10,
    font: options.bold ? ctx.bold : ctx.regular,
    color: options.muted ? rgb(0.42, 0.46, 0.52) : rgb(0.1, 0.12, 0.16),
  });
}

function sectionTitle(ctx: PdfContext, title: string): void {
  ensureSpace(ctx, 34);
  ctx.y -= 24;
  text(ctx, title.toUpperCase(), { size: 9, bold: true, color: rgb(0.35, 0.39, 0.46) });
  ctx.y -= 6;
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: PAGE_WIDTH - MARGIN, y: ctx.y },
    thickness: 0.7,
    color: rgb(0.85, 0.87, 0.9),
  });
}

export async function buildPayslipPdf(
  payslip: PayrollPayslipDetail,
  company: { name: string; addressLine: string | null; city: string | null; email: string },
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Payslip ${payslip.employeeNumber} ${payslip.period.name}`);
  doc.setAuthor(company.name);
  doc.setSubject("Employee payslip");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ctx: PdfContext = {
    doc,
    page: doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    regular,
    bold,
    y: PAGE_HEIGHT - MARGIN,
  };

  text(ctx, company.name, { size: 16, bold: true });
  ctx.y -= 16;
  text(ctx, [company.addressLine, company.city].filter(Boolean).join(", ") || company.email, {
    size: 9,
    color: rgb(0.42, 0.46, 0.52),
  });
  ctx.y -= 12;
  text(ctx, company.email, { size: 9, color: rgb(0.42, 0.46, 0.52) });

  ctx.y -= 44;
  text(ctx, "PAYSLIP", { size: 22, bold: true });
  ctx.y -= 20;
  text(ctx, `${payslip.period.name} · ${payslip.period.startDate} to ${payslip.period.endDate}`, {
    size: 10,
    color: rgb(0.42, 0.46, 0.52),
  });

  sectionTitle(ctx, "Employee");
  row(ctx, "Employee", `${payslip.employeeName} (${payslip.employeeNumber})`);
  if (payslip.department) row(ctx, "Department", payslip.department);
  if (payslip.position) row(ctx, "Position", payslip.position);
  row(ctx, "Payment date", payslip.period.paymentDate);
  row(ctx, "Payslip ID", payslip.id);

  const earnings = payslip.lines.filter((line) => line.componentType === "EARNING");
  const deductions = payslip.lines.filter((line) => line.componentType === "DEDUCTION");
  const employer = payslip.lines.filter((line) => line.componentType === "EMPLOYER_CONTRIBUTION");
  const informational = payslip.lines.filter((line) => line.componentType === "INFORMATIONAL");

  sectionTitle(ctx, "Earnings");
  for (const line of earnings) {
    row(ctx, line.name, formatAmount(line.amount, payslip.currency), {
      indent: 8,
      muted: line.code === "BASE_SALARY",
    });
  }
  row(ctx, "Gross pay", formatAmount(payslip.grossPay, payslip.currency), { bold: true });

  sectionTitle(ctx, "Deductions");
  if (deductions.length === 0) {
    row(ctx, "No deductions", formatAmount("0", payslip.currency), { muted: true, indent: 8 });
  }
  for (const line of deductions) {
    row(ctx, line.name, formatAmount(line.amount, payslip.currency), { indent: 8 });
  }
  row(ctx, "Total deductions", formatAmount(payslip.totalDeductions, payslip.currency), {
    bold: true,
  });

  if (employer.length > 0) {
    sectionTitle(ctx, "Employer contributions (not deducted from net pay)");
    for (const line of employer) {
      row(ctx, line.name, formatAmount(line.amount, payslip.currency), { indent: 8, muted: true });
    }
    row(ctx, "Total employer contributions", formatAmount(payslip.employerContributions, payslip.currency), {
      bold: true,
    });
  }

  if (informational.length > 0) {
    sectionTitle(ctx, "Information");
    for (const line of informational) {
      row(ctx, line.name, formatAmount(line.amount, payslip.currency), { indent: 8, muted: true });
    }
  }

  ensureSpace(ctx, 66);
  ctx.y -= 28;
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y - 10,
    width: PAGE_WIDTH - MARGIN * 2,
    height: 38,
    color: rgb(0.94, 0.96, 0.99),
  });
  text(ctx, "NET PAY", { x: MARGIN + 14, size: 12, bold: true });
  const net = formatAmount(payslip.netPay, payslip.currency);
  ctx.page.drawText(net, {
    x: PAGE_WIDTH - MARGIN - 14 - bold.widthOfTextAtSize(net, 14),
    y: ctx.y + 2,
    size: 14,
    font: bold,
    color: rgb(0.05, 0.36, 0.28),
  });

  if (payslip.warnings.length > 0) {
    sectionTitle(ctx, "Calculation notes");
    for (const warning of payslip.warnings) {
      ensureSpace(ctx, 16);
      ctx.y -= 14;
      text(ctx, `• ${warning.replaceAll("_", " ").toLowerCase()}`, {
        size: 8,
        color: rgb(0.55, 0.38, 0.05),
      });
    }
  }

  const footer = `Generated ${new Date().toISOString().slice(0, 10)} · This payslip is a system-generated document.`;
  ctx.page.drawText(footer, {
    x: MARGIN,
    y: 36,
    size: 7.5,
    font: regular,
    color: rgb(0.55, 0.58, 0.63),
  });

  return doc.save();
}
