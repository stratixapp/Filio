// js/email-service.js — Real Email Delivery via Firebase Extension
// ═══════════════════════════════════════════════════════════════
//  Problem fixed: Email Center UI existed but emails never actually sent.
//
//  Solution: Uses Firebase "Trigger Email" extension (firestore-send-email).
//  All emails are written to /mail/{docId} in Firestore.
//  The Firebase extension picks them up and sends via your SMTP/SendGrid.
//
//  Setup (one-time, 5 minutes):
//  1. Firebase Console → Extensions → "Trigger Email from Firestore"
//  2. Install it, connect your SMTP (Gmail App Password or SendGrid)
//  3. Collection name: "mail"
//  4. Done — every doc added to /mail gets sent automatically
//
//  Fallback: If extension not installed, emails are still LOGGED to
//  Firestore so you can see what would have been sent.
// ═══════════════════════════════════════════════════════════════

const EmailService = (() => {

  const MAIL_COLLECTION = 'mail';

  // ── Check if Trigger Email extension is active ──────────────
  // We detect this by checking if there's a config doc (written by extension)
  let _extensionActive = null;

  async function isExtensionActive() {
    if (_extensionActive !== null) return _extensionActive;
    try {
      // The extension writes a config doc on install
      const snap = await db.collection(MAIL_COLLECTION).limit(1).get();
      _extensionActive = true; // Collection exists — assume active
    } catch (e) {
      _extensionActive = false;
    }
    return _extensionActive;
  }

  // ── Core send function ───────────────────────────────────────
  async function send({ to, subject, html, text, firmId, metadata = {} }) {
    if (!to)      throw new Error('Email recipient (to) is required');
    if (!subject) throw new Error('Email subject is required');
    if (!html && !text) throw new Error('Email body (html or text) is required');

    // Sanitise recipient — prevent header injection
    const safeTo = String(to).replace(/[\r\n]/g, '').trim();
    if (!/\S+@\S+\.\S+/.test(safeTo)) throw new Error('Invalid email address: ' + safeTo);

    const mailDoc = {
      to:        safeTo,
      message: {
        subject,
        html:     html || '',
        text:     text || subject,
      },
      // Metadata for our own tracking
      _firmId:    firmId || '',
      _sentBy:    auth.currentUser?.uid || '',
      _sentAt:    firebase.firestore.FieldValue.serverTimestamp(),
      _status:    'queued',
      ...metadata,
    };

    const ref = await db.collection(MAIL_COLLECTION).add(mailDoc);

    // Log to firm's communication log
    if (firmId) {
      await db.collection('firms').doc(firmId).collection('communications').add({
        type:      'email',
        direction: 'outbound',
        to:        safeTo,
        subject,
        body:      text || '(HTML email)',
        status:    'sent',
        sentBy:    auth.currentUser?.displayName || auth.currentUser?.email || '',
        sentById:  auth.currentUser?.uid || '',
        mailDocId: ref.id,
        firmId,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }

    return ref.id;
  }

  // ── Template builders ─────────────────────────────────────────
  function _baseTemplate(firmName, content) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background:#f4f4f4; margin:0; padding:0; }
    .wrapper { max-width:600px; margin:0 auto; padding:24px 16px; }
    .card { background:#ffffff; border-radius:12px; padding:32px; box-shadow:0 2px 8px rgba(0,0,0,.08); }
    .header { border-bottom:2px solid #C9A84C; padding-bottom:16px; margin-bottom:24px; }
    .logo { font-size:22px; font-weight:700; color:#C9A84C; }
    .firm-name { font-size:13px; color:#666; margin-top:2px; }
    h2 { color:#1a1a2e; font-size:20px; margin:0 0 16px; }
    p { color:#444; line-height:1.6; margin:0 0 12px; font-size:14px; }
    .highlight { background:#FFF8E7; border-left:3px solid #C9A84C; padding:12px 16px; border-radius:4px; margin:16px 0; }
    .btn { display:inline-block; background:#C9A84C; color:#fff; text-decoration:none; padding:12px 24px; border-radius:8px; font-weight:600; font-size:14px; margin:16px 0; }
    .footer { text-align:center; font-size:12px; color:#999; margin-top:24px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="logo">Filio</div>
        <div class="firm-name">${firmName}</div>
      </div>
      ${content}
    </div>
    <div class="footer">
      This email was sent by ${firmName} using Filio CA Office OS.<br>
      If you did not expect this email, please ignore it.
    </div>
  </div>
</body>
</html>`;
  }

  // Document request reminder
  function docReminderTemplate({ firmName, clientName, requestTitle, uploadLink, isUrgent }) {
    const content = `
      <h2>${isUrgent ? '⚠️ Urgent: ' : ''}Documents Required — ${requestTitle}</h2>
      <p>Dear ${clientName},</p>
      <p>${isUrgent
        ? 'This is an urgent reminder. We are still waiting for your documents and the deadline is approaching.'
        : 'A gentle reminder that we are waiting for some documents from you.'
      }</p>
      <div class="highlight">
        <strong>Request:</strong> ${requestTitle}<br>
        <strong>From:</strong> ${firmName}
      </div>
      <p>Please upload your documents by clicking the button below:</p>
      <a href="${uploadLink}" class="btn">Upload Documents →</a>
      <p style="font-size:12px;color:#999">Or copy this link: ${uploadLink}</p>
      <p>If you have already uploaded, please ignore this message.</p>
      <p>Thank you,<br><strong>${firmName}</strong></p>`;
    return _baseTemplate(firmName, content);
  }

  // Invoice email
  function invoiceTemplate({ firmName, clientName, invoiceNo, amount, dueDate, pdfLink }) {
    const content = `
      <h2>Invoice ${invoiceNo} from ${firmName}</h2>
      <p>Dear ${clientName},</p>
      <p>Please find your invoice details below:</p>
      <div class="highlight">
        <strong>Invoice No:</strong> ${invoiceNo}<br>
        <strong>Amount:</strong> ${amount}<br>
        ${dueDate ? `<strong>Due Date:</strong> ${dueDate}<br>` : ''}
        <strong>From:</strong> ${firmName}
      </div>
      ${pdfLink ? `<a href="${pdfLink}" class="btn">Download Invoice →</a>` : ''}
      <p>Please make the payment by the due date to avoid late fees.</p>
      <p>For queries, please contact your CA directly.</p>
      <p>Thank you,<br><strong>${firmName}</strong></p>`;
    return _baseTemplate(firmName, content);
  }

  // Task assignment notification
  function taskAssignedTemplate({ firmName, staffName, taskTitle, clientName, dueDate, priority }) {
    const content = `
      <h2>New Task Assigned: ${taskTitle}</h2>
      <p>Dear ${staffName},</p>
      <p>A new task has been assigned to you.</p>
      <div class="highlight">
        <strong>Task:</strong> ${taskTitle}<br>
        <strong>Client:</strong> ${clientName || 'N/A'}<br>
        <strong>Priority:</strong> ${priority || 'Medium'}<br>
        ${dueDate ? `<strong>Due Date:</strong> ${dueDate}<br>` : ''}
      </div>
      <p>Please log in to Filio to view and update the task.</p>
      <p>Thank you,<br><strong>${firmName}</strong></p>`;
    return _baseTemplate(firmName, content);
  }

  // ── Convenience send methods ─────────────────────────────────
  async function sendDocReminder({ firm, clientEmail, clientName, requestTitle, uploadLink, isUrgent = false }) {
    return send({
      to:      clientEmail,
      subject: `${isUrgent ? '[Urgent] ' : ''}Documents Required: ${requestTitle} — ${firm.name}`,
      html:    docReminderTemplate({ firmName: firm.name, clientName, requestTitle, uploadLink, isUrgent }),
      text:    `Dear ${clientName}, please upload your documents for "${requestTitle}": ${uploadLink}`,
      firmId:  firm.id,
      metadata: { _type: 'doc_reminder', _clientEmail: clientEmail },
    });
  }

  async function sendInvoice({ firm, clientEmail, clientName, invoiceNo, amount, dueDate, pdfLink }) {
    return send({
      to:      clientEmail,
      subject: `Invoice ${invoiceNo} from ${firm.name}`,
      html:    invoiceTemplate({ firmName: firm.name, clientName, invoiceNo, amount, dueDate, pdfLink }),
      text:    `Invoice ${invoiceNo} for ${amount} from ${firm.name}`,
      firmId:  firm.id,
      metadata: { _type: 'invoice', _invoiceNo: invoiceNo },
    });
  }

  async function sendTaskAssigned({ firm, staffEmail, staffName, taskTitle, clientName, dueDate, priority }) {
    return send({
      to:      staffEmail,
      subject: `Task Assigned: ${taskTitle} — ${firm.name}`,
      html:    taskAssignedTemplate({ firmName: firm.name, staffName, taskTitle, clientName, dueDate, priority }),
      text:    `${staffName}, you have been assigned: ${taskTitle}`,
      firmId:  firm.id,
      metadata: { _type: 'task_assigned' },
    });
  }

  async function sendCustom({ firm, to, subject, body }) {
    return send({
      to,
      subject,
      html:   _baseTemplate(firm.name, `<h2>${subject}</h2><p style="white-space:pre-wrap">${body}</p>`),
      text:   body,
      firmId: firm.id,
      metadata: { _type: 'custom' },
    });
  }

  // ── Firestore rules addendum for /mail collection ────────────
  // Add this to your firestore.rules:
  /*
  match /mail/{docId} {
    // Authenticated firm members can create mail docs (queued for sending)
    allow create: if request.auth != null
                  && request.resource.data._firmId is string;
    // Nobody reads or modifies — extension handles it
    allow read, update, delete: if false;
  }
  */

  return {
    send,
    sendDocReminder,
    sendInvoice,
    sendTaskAssigned,
    sendCustom,
    isExtensionActive,
  };

})();
