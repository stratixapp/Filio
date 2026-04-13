// js/pages/report-generator.js — Phase 5: AI Report Generation + PDF Output
// Uses Claude API to generate professional financial reports
// Falls back to structured template if API not configured

const ReportGenerator = {

  // ── Main entry point ──────────────────────────────────────
  async generate(firm, purchase, purchaseId) {
    const { reportId, reportName, clientName, category } = purchase;

    try {
      // Claude API key is stored securely in Firestore (firm.anthropicApiKey).
      // ApiProxy.claudeGenerate reads it server-side — never from source code.
      // Returns null if no key is configured → falls back to template.
      let reportContent;
      const systemPrompt = 'You are a professional Indian Chartered Accountant assistant. Generate clear, structured financial reports with Indian Rupee amounts and Indian number system (lakhs/crores). Be factual and professional.';
      const userPrompt   = this._buildPrompt(reportId, reportName, clientName, firm);

      const aiText = await ApiProxy.claudeGenerate(firm, systemPrompt, userPrompt, 2000);

      if (aiText) {
        reportContent = aiText;
      } else {
        // Structured template fallback (fully usable without API key)
        reportContent = this._generateTemplate(firm, purchase);
      }

      // Update purchase record with generated content
      await DataIntegrity.withRetry(() => FS.updateReportPurchase(firm.id, purchaseId, {
        status:        'completed',
        reportContent,
        generatedAt:   new Date(),
        generatedWith: aiText ? 'claude-api' : 'template',
      }), { label: 'reportComplete' });

      // Open PDF
      ReportPDF.open({ ...purchase, reportContent }, firm);
      Toast.success('Report ready! Downloading PDF…');

    } catch(e) {
      console.error('[Filio] Report generation failed:', e);
      await DataIntegrity.withRetry(() => FS.updateReportPurchase(firm.id, purchaseId, {
        status:  'failed',
        errorMsg: e.message,
      }), { label: 'reportFailed' });
      Toast.error('Report generation failed. Your CA will deliver it manually.');
    }
  },

  // ── Prompt builder for each report type ──────────────────
  _buildPrompt(reportId, reportName, clientName, firm) {
    const prompts = {
      itr_summary: `Generate a professional ITR Filing Summary report for client "${clientName}" filed with CA firm "${firm.name}". Include: income sources breakdown, deductions claimed under 80C/80D/80E/80G, total tax liability, TDS already deducted, net tax payable or refund due, and refund status. Use Indian Rupee amounts. Format as a clean professional report with clear sections. Keep it factual and structured. End with a note that this is an AI-generated summary based on data entered by the CA firm.`,

      tax_saving: `Generate a Tax Saving Opportunity Report for "${clientName}" served by CA firm "${firm.name}". Include: current investments under 80C with remaining limit (80C limit ₹1.5L), 80D health insurance opportunities (₹25,000 individual, ₹50,000 senior citizen), NPS Section 80CCD(1B) additional ₹50,000, HRA exemption if applicable, home loan interest under Section 24, and other applicable deductions. Show potential tax savings in rupees for 20%, 30% and no-tax slabs. Format professionally for Indian taxpayers.`,

      capital_gains: `Generate a Capital Gains Computation Report for "${clientName}" by CA firm "${firm.name}". Include sections for: Equity & Mutual Funds (STCG at 15%, LTCG above ₹1L at 10%), Debt Mutual Funds (as per slab), Real Estate (STCG as income, LTCG at 20% with indexation), and any other assets. Explain holding periods (equity: 12 months, debt: 36 months, property: 24 months). Show total STCG, LTCG, and estimated tax. Note: Format with INR amounts using Indian number system (lakhs, crores).`,

      gst_health: `Generate a GST Health Check Report for "${clientName}" by CA firm "${firm.name}". Include: analysis of GSTR-1 vs GSTR-3B reconciliation status, ITC utilisation efficiency, late filing penalties if any (₹25/day for nil returns, ₹50/day for others), interest on delayed GST payment (18% per annum), HSN code compliance status, E-way bill compliance, and actionable recommendations to avoid future penalties. Structure as a professional compliance health check.`,

      compliance_cal: `Generate a 12-Month Compliance Calendar for "${clientName}" by CA firm "${firm.name}". Create a month-by-month calendar for the current financial year (April to March) showing: GST due dates (GSTR-1 on 11th, GSTR-3B on 20th monthly), TDS deposit (7th monthly), Advance Tax quarters (June 15, Sep 15, Dec 15, Mar 15), TDS returns quarterly, ITR filing deadline, ROC annual returns if applicable. Format as a clear, actionable calendar they can reference all year.`,

      profitability: `Generate a Profitability Analysis Report for "${clientName}" by CA firm "${firm.name}". Include: Revenue breakdown by category, Cost of Goods Sold, Gross Profit and Gross Margin %, Operating Expenses breakdown, EBITDA, Depreciation and Amortisation, EBIT, Interest expenses, PBT (Profit Before Tax), Tax provision, PAT (Profit After Tax) and Net Margin %. Add a brief commentary on profitability trends and key ratios. Use Indian Rupee amounts in lakhs.`,

      net_worth: `Generate a Net Worth Statement for "${clientName}" by CA firm "${firm.name}". Structure as: ASSETS — Fixed Assets (property, vehicles, equipment), Financial Assets (bank balances, FDs, stocks, mutual funds, PPF/EPF, insurance surrender values, gold), Current Assets (receivables, loans given). LIABILITIES — Long-term (home loan, business loans), Short-term (credit cards, personal loans, overdraft). Calculate Net Worth = Total Assets - Total Liabilities. Add a brief note on asset allocation percentages.`,
    };

    const defaultPrompt = `Generate a professional ${reportName} for client "${clientName}" by CA firm "${firm.name}". Provide a structured, detailed financial report with clear sections, Indian Rupee amounts using the Indian number system (lakhs, crores), and actionable insights. Keep it professional and factual. End with a disclaimer that this report is based on data provided by the CA firm.`;

    return prompts[reportId] || defaultPrompt;
  },

  // ── Template fallback (no API key needed) ─────────────────
  _generateTemplate(firm, purchase) {
    const { reportName, clientName } = purchase;
    const now = new Date().toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' });
    return `${reportName.toUpperCase()}
Generated for: ${clientName}
Prepared by: ${firm.name}
Date: ${now}
Reference: FY ${new Date().getFullYear()-1}-${String(new Date().getFullYear()).slice(-2)}

─────────────────────────────────────────────

IMPORTANT NOTICE
This report has been generated based on data entered by your CA firm in Filio. For a personalised AI-generated version of this report with actual figures, please ask your CA to configure the AI integration.

SUMMARY
Client Name    : ${clientName}
CA Firm        : ${firm.name}
Report Type    : ${reportName}
Generated On   : ${now}

─────────────────────────────────────────────

For detailed figures and personalised analysis, please contact your CA:
${firm.name}
${firm.phone || ''}
${firm.email || ''}

─────────────────────────────────────────────
Powered by Filio — CA Office OS
This document is confidential and prepared exclusively for ${clientName}.`;
  },
};


// ── PDF Generator ─────────────────────────────────────────────
const ReportPDF = {
  open(purchase, firm) {
    const { reportName, clientName, reportContent, price, generatedAt } = purchase;
    const now  = new Date().toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' });
    const date = generatedAt
      ? (generatedAt.toDate ? generatedAt.toDate() : new Date(generatedAt)).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })
      : now;

    // Format content: replace newlines with <br>, bold lines that end with :
    const formatted = (reportContent || '').split('\n').map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '<br/>';
      if (trimmed.startsWith('─') || trimmed.startsWith('═')) return `<hr style="border:none;border-top:1px solid #C9A84C33;margin:.5rem 0"/>`;
      if (trimmed === trimmed.toUpperCase() && trimmed.length > 3 && !trimmed.includes(':')) {
        return `<div style="font-weight:700;color:#0A1628;font-size:.9rem;margin-top:.75rem;letter-spacing:.03em">${esc(trimmed)}</div>`;
      }
      if (trimmed.endsWith(':') && trimmed.length < 50) {
        return `<div style="font-weight:600;color:#0A1628;margin-top:.5rem">${esc(trimmed)}</div>`;
      }
      if (trimmed.includes(':')) {
        const [key, ...rest] = trimmed.split(':');
        if (rest.length && key.length < 30) {
          return `<div style="display:flex;gap:.5rem;padding:.2rem 0"><span style="color:#555;min-width:180px;flex-shrink:0">${esc(key)}:</span><span style="color:#0A1628;font-weight:500">${esc(rest.join(':').trim())}</span></div>`;
        }
      }
      return `<div style="color:#333;line-height:1.7">${esc(trimmed)}</div>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>${esc(reportName)} — ${esc(clientName)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #333; font-size: 13px; }
  .page { max-width: 760px; margin: 0 auto; padding: 2rem; }

  /* Header */
  .header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:1.25rem; border-bottom:3px solid #C9A84C; margin-bottom:1.5rem; }
  .firm-name { font-size:1.3rem; font-weight:800; color:#0A1628; letter-spacing:-.01em; }
  .firm-sub { font-size:.7rem; color:#888; text-transform:uppercase; letter-spacing:.1em; margin-top:.2rem; }
  .header-right { text-align:right; }
  .report-title { font-size:.65rem; text-transform:uppercase; letter-spacing:.1em; color:#C9A84C; font-weight:700; margin-bottom:.25rem; }
  .report-name { font-size:1rem; font-weight:700; color:#0A1628; max-width:240px; text-align:right; line-height:1.3; }

  /* Client info bar */
  .client-bar { background:#F7F3EC; border-left:4px solid #C9A84C; padding:.875rem 1rem; border-radius:0 6px 6px 0; margin-bottom:1.5rem; display:flex; justify-content:space-between; flex-wrap:wrap; gap:.5rem; }
  .client-field label { font-size:.65rem; text-transform:uppercase; letter-spacing:.08em; color:#888; display:block; }
  .client-field span { font-size:.875rem; font-weight:700; color:#0A1628; }

  /* Content */
  .content { line-height:1.7; }
  .watermark { position:fixed; bottom:1rem; right:1rem; font-size:.65rem; color:#ccc; }

  /* Footer */
  .footer { margin-top:2rem; padding-top:1rem; border-top:1px solid #eee; display:flex; justify-content:space-between; align-items:center; }
  .footer-brand { font-size:.7rem; color:#888; }
  .footer-brand strong { color:#C9A84C; }
  .footer-page { font-size:.7rem; color:#aaa; }
  .disclaimer { margin-top:.75rem; font-size:.65rem; color:#aaa; line-height:1.6; }

  /* Gold badge */
  .badge { display:inline-block; padding:.2rem .6rem; border-radius:20px; font-size:.65rem; font-weight:700; background:rgba(201,168,76,.12); color:#C9A84C; border:1px solid rgba(201,168,76,.25); }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display:none; }
    .watermark { display:none; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="firm-name">${esc(firm?.name||'CA Firm')}</div>
      <div class="firm-sub">Chartered Accountants</div>
      ${firm?.gstin ? `<div style="font-size:.68rem;color:#888;margin-top:.25rem">GSTIN: ${esc(firm.gstin)}</div>` : ''}
    </div>
    <div class="header-right">
      <div class="report-title">Financial Report</div>
      <div class="report-name">${esc(reportName)}</div>
      <div style="margin-top:.5rem"><span class="badge">Powered by Filio</span></div>
    </div>
  </div>

  <div class="client-bar">
    <div class="client-field"><label>Prepared For</label><span>${esc(clientName)}</span></div>
    <div class="client-field"><label>Report Date</label><span>${date}</span></div>
    <div class="client-field"><label>Financial Year</label><span>FY ${new Date().getFullYear()-1}–${String(new Date().getFullYear()).slice(-2)}</span></div>
    <div class="client-field"><label>Report ID</label><span style="font-size:.75rem;font-family:monospace">${(purchase.id||'—').slice(0,8).toUpperCase()}</span></div>
  </div>

  <div class="content">${formatted}</div>

  <div class="footer">
    <div>
      <div class="footer-brand">Generated by <strong>Filio</strong> — CA Office OS · ${esc(firm?.name||'')}</div>
      <div class="disclaimer">
        This report is confidential and prepared exclusively for ${esc(clientName)}.
        All figures are based on data provided by the CA firm. This is not a substitute for professional tax advice.
        Verify all figures with your CA before making financial decisions.
      </div>
    </div>
  </div>
</div>

<div class="watermark">CONFIDENTIAL · ${esc(clientName)}</div>

<div class="no-print" style="position:fixed;top:1rem;right:1rem;display:flex;gap:.5rem">
  <button onclick="window.print()" style="background:#C9A84C;color:#0A1628;border:none;padding:.5rem 1rem;border-radius:6px;font-weight:700;cursor:pointer;font-size:.875rem">
    ⬇ Download / Print PDF
  </button>
  <button onclick="window.close()" style="background:#0A1628;color:#888;border:1px solid #333;padding:.5rem 1rem;border-radius:6px;cursor:pointer;font-size:.875rem">
    Close
  </button>
</div>

<script>
  // Auto-trigger print dialog
  window.addEventListener('load', function() {
    setTimeout(function() { window.print(); }, 800);
  });
</script>
</body></html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  },
};
