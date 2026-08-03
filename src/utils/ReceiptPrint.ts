// src/utils/receiptPrint.ts

const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
];
const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

function twoDigits(n: number): string {
    if (n < 20) return ones[n];
    return `${tens[Math.floor(n / 10)]}${n % 10 ? " " + ones[n % 10] : ""}`;
}

function threeDigits(n: number): string {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    return `${hundred ? ones[hundred] + " Hundred" : ""}${hundred && rest ? " " : ""}${rest ? twoDigits(rest) : ""}`;
}

export function amountToWords(amount: number): string {
    const rupees = Math.floor(amount);
    const paise = Math.round((amount - rupees) * 100);

    if (rupees === 0 && paise === 0) return "Zero Rupees Only";

    let n = rupees;
    const crore = Math.floor(n / 10000000); n %= 10000000;
    const lakh = Math.floor(n / 100000); n %= 100000;
    const thousand = Math.floor(n / 1000); n %= 1000;
    const hundred = n;

    const parts: string[] = [];
    if (crore) parts.push(`${threeDigits(crore)} Crore`);
    if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
    if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
    if (hundred) parts.push(threeDigits(hundred));

    let words = parts.join(" ").trim() || "Zero";
    words = `${words} Rupees`;
    if (paise) words += ` and ${twoDigits(paise)} Paise`;
    return `${words} Only`;
}

interface ReceiptData {
    voucher_no: string;
    date: string;
    type: string;
    amount: number | string;
    narration?: string;
    party_name?: string;
    op_account?: string | number;

    party_address?: string;
    party_city?: string;
    party_state?: string;
    party_country?: string;
    party_pincode?: string;
    party_phone?: string;
    party_mobile?: string;
    party_email?: string;
    party_gst_no?: string;
    party_pan_card?: string;


    // bank-only
    bank_account_name?: string;
    bank_account?: string | number;
    mode?: string;
    cheque_no?: string;
    cheque_date?: string;
    cheque_clear_date?: string;

    // cash-only
    cash_account_name?: string;
    cash_account?: string | number;

    // branch (from serializer, multi-branch aware)
    branch_name?: string;
    branch_owner_name?: string;
    branch_address?: string;
    branch_city?: string;
    branch_state?: string;
    branch_country?: string;
    branch_pincode?: string;
    branch_phone?: string;
    branch_email?: string;
}

function buildBranchLines(r: ReceiptData): string {
    const addressBits = [r.branch_address, r.branch_city, r.branch_state, r.branch_country]
        .filter(Boolean)
        .join(", ");
    const pincode = r.branch_pincode ? `- ${r.branch_pincode}` : "";
    const contactBits = [r.branch_phone, r.branch_email].filter(Boolean).join(" | ");

    return `
    ${addressBits ? `${addressBits} ${pincode}<br/>` : ""}
    ${contactBits ? contactBits : ""}
  `;
}

function buildPartyAddress(r: ReceiptData): string {
    const bits = [r.party_address, r.party_city, r.party_state, r.party_country]
        .filter(Boolean)
        .join(", ");
    const pincode = r.party_pincode ? ` - ${r.party_pincode}` : "";
    return bits ? `${bits}${pincode}` : "";
}

export function generateReceiptHTML(receipt: ReceiptData, kind: "bank" | "cash"): string {
    const isBank = kind === "bank";
    const amountNum = Number(receipt.amount || 0);
    const paymentTypeLabel = isBank ? "BANK" : "CASH";
    const accountName = isBank
        ? receipt.bank_account_name || String(receipt.bank_account || "-")
        : receipt.cash_account_name || String(receipt.cash_account || "-");
    const partyName = receipt.party_name || String(receipt.op_account || "-");
    const branchName = receipt.branch_name || "Branch";

    const modeRow =
        isBank && receipt.mode
            ? `<div class="row"><span class="label">Payment Mode:</span><span class="value">${receipt.mode}</span></div>`
            : "";

    const chequeRows =
        isBank && receipt.mode === "CHEQUE"
            ? `
        <div class="row"><span class="label">Cheque No:</span><span class="value">${receipt.cheque_no || "-"}</span></div>
        <div class="row"><span class="label">Cheque Date:</span><span class="value">${receipt.cheque_date || "-"}</span></div>
        <div class="row"><span class="label">Clear Date:</span><span class="value">${receipt.cheque_clear_date || "-"}</span></div>
      `
            : "";

    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Receipt ${receipt.voucher_no}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 24px; background: #f3f4f6; color: #1f2937; }
  .sheet { max-width: 720px; margin: 0 auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
  .header { padding: 20px 24px; border-bottom: 1px solid #e5e7eb; }
  .company-name { font-size: 22px; font-weight: 800; color: #2563eb; margin: 0 0 4px 0; }
  .company-meta { font-size: 12px; color: #374151; line-height: 1.6; }
  .banner { background: #2563eb; color: #fff; padding: 10px 24px; display: flex; justify-content: space-between; align-items: center; }
  .banner h2 { margin: 0; font-size: 16px; letter-spacing: 0.5px; }
  .badge { border: 1px solid #93c5fd; padding: 4px 10px; border-radius: 4px; font-size: 12px; }
  .grid { display: flex; gap: 16px; padding: 20px 24px; }
  .box { flex: 1; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; }
  .box-title { background: #2563eb; color: #fff; font-size: 13px; font-weight: 600; padding: 8px 12px; }
  .box-body { padding: 12px; }
  .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #e5e7eb; font-size: 13px; gap: 12px; }
  .row:last-child { border-bottom: none; }
  .label { color: #6b7280; white-space: nowrap; }
  .value { font-weight: 600; text-align: right; }
  .amount-strip { margin: 0 24px 20px 24px; background: #eff6ff; border: 1px solid #93c5fd; border-radius: 6px; padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .amount-strip .sum-label { font-size: 12px; color: #2563eb; }
  .amount-strip .sum-words { font-weight: 700; color: #2563eb; }
  .amount-strip .sum-value { font-size: 22px; font-weight: 800; color: #2563eb; white-space: nowrap; }
  .signatures { display: flex; justify-content: space-between; padding: 40px 24px 24px 24px; }
  .sig-line { width: 45%; text-align: center; border-top: 1px solid #9ca3af; padding-top: 6px; font-size: 12px; color: #374151; }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { border: none; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <p class="company-name">${branchName}</p>
      <div class="company-meta">
        ${buildBranchLines(receipt)}
        ${receipt.branch_owner_name ? `Owner: ${receipt.branch_owner_name}` : ""}
      </div>
    </div>

    <div class="banner">
      <h2>RECEIPT VOUCHER</h2>
      <span class="badge">Customer Copy</span>
    </div>

    <div class="grid">
      <div class="box">
        <div class="box-title">Receipt Info</div>
        <div class="box-body">
          <div class="row"><span class="label">Receipt No:</span><span class="value">${receipt.voucher_no}</span></div>
          <div class="row"><span class="label">Date:</span><span class="value">${receipt.date}</span></div>
          <div class="row"><span class="label">Payment Type:</span><span class="value">${paymentTypeLabel}</span></div>
          ${modeRow}
          ${chequeRows}
          <div class="row"><span class="label">${isBank ? "Bank" : "Cash"} Account:</span><span class="value">${accountName}</span></div>
          <div class="row"><span class="label">Amount:</span><span class="value">₹ ${amountNum.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></div>
          ${receipt.narration ? `<div class="row"><span class="label">Narration:</span><span class="value">${receipt.narration}</span></div>` : ""}
        </div>
      </div>

        <div class="box">
        <div class="box-title">Received With Thanks From</div>
        <div class="box-body">
          <div class="row"><span class="label">Name:</span><span class="value">${partyName}</span></div>
          ${buildPartyAddress(receipt) ? `<div class="row"><span class="label">Address:</span><span class="value">${buildPartyAddress(receipt)}</span></div>` : ""}
          ${(receipt.party_mobile || receipt.party_phone) ? `<div class="row"><span class="label">Mobile No:</span><span class="value">${receipt.party_mobile || receipt.party_phone}</span></div>` : ""}
          ${receipt.party_email ? `<div class="row"><span class="label">Email:</span><span class="value">${receipt.party_email}</span></div>` : ""}
          ${receipt.party_gst_no ? `<div class="row"><span class="label">GSTIN:</span><span class="value">${receipt.party_gst_no}</span></div>` : ""}
          ${receipt.party_pan_card ? `<div class="row"><span class="label">PAN:</span><span class="value">${receipt.party_pan_card}</span></div>` : ""}
          
        </div>
      </div>
    </div>

    <div class="amount-strip">
      <div>
        <div class="sum-label">The Sum Of:</div>
        <div class="sum-words">${amountToWords(amountNum)}</div>
      </div>
      <div class="sum-value">₹ ${amountNum.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
    </div>

    <div class="signatures">
      <div class="sig-line">Signature of Customer</div>
      <div class="sig-line">Authorised Signatory</div>
    </div>
  </div>
  <script>
    window.onload = function () { window.print(); };
  </script>
</body>
</html>
`;
}

export function printReceipt(receipt: ReceiptData, kind: "bank" | "cash") {
    const html = generateReceiptHTML(receipt, kind);
    const win = window.open("", "_blank", "width=800,height=900");
    if (!win) {
        alert("Please allow popups to print the receipt.");
        return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
}