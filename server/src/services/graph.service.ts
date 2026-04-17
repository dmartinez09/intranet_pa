import * as msal from '@azure/msal-node';

// ============================================================
// MICROSOFT GRAPH SERVICE
// Reads emails from M365 mailboxes via Graph API
// - alertasSapPA@pointamericas.com       (SAP alerts)
// - facturacionpointandina@pointamericas.com (billing CPEs)
// ============================================================

const config = {
  tenantId: process.env.MS_TENANT_ID || '',
  clientId: process.env.MS_CLIENT_ID || '',
  clientSecret: process.env.MS_CLIENT_SECRET || '',
  alertEmail: process.env.MS_ALERT_EMAIL || 'alertasSapPA@pointamericas.com',
  facturacionEmail: process.env.MS_FACTURACION_EMAIL || 'facturacionpointandina@pointamericas.com',
};

let msalClient: msal.ConfidentialClientApplication | null = null;

function getMsalClient(): msal.ConfidentialClientApplication {
  if (!msalClient) {
    msalClient = new msal.ConfidentialClientApplication({
      auth: {
        clientId: config.clientId,
        authority: `https://login.microsoftonline.com/${config.tenantId}`,
        clientSecret: config.clientSecret,
      },
    });
  }
  return msalClient;
}

async function getAccessToken(): Promise<string> {
  const client = getMsalClient();
  const result = await client.acquireTokenByClientCredential({
    scopes: ['https://graph.microsoft.com/.default'],
  });
  if (!result?.accessToken) throw new Error('Failed to acquire Graph API token');
  return result.accessToken;
}

async function graphRequest(endpoint: string): Promise<any> {
  const token = await getAccessToken();
  const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Graph API error ${response.status}: ${text}`);
  }
  return response.json();
}

async function graphPost(endpoint: string, body: any): Promise<any> {
  const token = await getAccessToken();
  const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Graph API POST error ${response.status}: ${text}`);
  }
  // sendMail returns 202 with no body
  if (response.status === 202 || response.headers.get('content-length') === '0') return { success: true };
  return response.json();
}

async function graphGetRaw(endpoint: string): Promise<Buffer> {
  const token = await getAccessToken();
  const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Graph API error ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export const graphService = {
  isConfigured(): boolean {
    return !!(config.tenantId && config.clientId && config.clientSecret);
  },

  /**
   * Get recent alert emails from the SAP alerts mailbox.
   * Returns the last `count` emails matching "Alertas Sap Point Andina" subject.
   */
  async getAlertEmails(count = 20, filter?: string): Promise<any[]> {
    if (!this.isConfigured()) {
      console.warn('Graph API not configured - returning empty email list');
      return [];
    }

    try {
      const mailbox = encodeURIComponent(config.alertEmail);
      // SAP uses this mailbox as sender — alerts are in Sent Items
      let url = `/users/${mailbox}/mailFolders/SentItems/messages?$top=${count}&$orderby=sentDateTime desc&$select=id,subject,toRecipients,sentDateTime,bodyPreview,body,hasAttachments`;

      if (filter) {
        url += `&$filter=${encodeURIComponent(filter)}`;
      }

      const data = await graphRequest(url);
      return (data.value || []).map((msg: any) => ({
        id: msg.id,
        subject: msg.subject,
        to: (msg.toRecipients || []).map((r: any) => r.emailAddress?.address).filter(Boolean),
        sentDateTime: msg.sentDateTime,
        preview: msg.bodyPreview,
        bodyHtml: msg.body?.content || '',
        hasAttachments: msg.hasAttachments,
      }));
    } catch (error) {
      console.error('Error fetching alert emails:', error);
      return [];
    }
  },

  /**
   * Get a specific email body (HTML) to render the alert grid.
   */
  async getEmailBody(messageId: string): Promise<string> {
    if (!this.isConfigured()) return '<p>Graph API no configurado</p>';

    try {
      const mailbox = encodeURIComponent(config.alertEmail);
      const data = await graphRequest(`/users/${mailbox}/messages/${messageId}?$select=body`);
      return data.body?.content || '<p>Sin contenido</p>';
    } catch (error) {
      console.error('Error fetching email body:', error);
      return '<p>Error al obtener el correo</p>';
    }
  },

  /**
   * Get email folders (Inbox, etc.) for debugging.
   */
  async getMailFolders(): Promise<any[]> {
    if (!this.isConfigured()) return [];

    try {
      const mailbox = encodeURIComponent(config.alertEmail);
      const data = await graphRequest(`/users/${mailbox}/mailFolders?$top=10`);
      return data.value || [];
    } catch (error) {
      console.error('Error fetching mail folders:', error);
      return [];
    }
  },

  // ============================================================
  // FACTURACIÓN ELECTRÓNICA
  // ============================================================

  /**
   * Parse subject line to extract document type and number.
   * Subject pattern: "RV: POINT ANDINA S.A. Te ha enviado un nuevo CPE FACTURA ELECTRONICA F001-00039306 / 39307"
   */
  parseFacturacionSubject(subject: string): { tipoDocumento: string; numeroDocumento: string } {
    const subjectUpper = (subject || '').toUpperCase();
    let tipoDocumento = 'OTRO';
    if (subjectUpper.includes('FACTURA ELECTR')) tipoDocumento = 'FACTURA';
    else if (subjectUpper.includes('GUIA DE REMISION') || subjectUpper.includes('GUÍA DE REMISIÓN')) tipoDocumento = 'GUIA DE REMISION';
    else if (subjectUpper.includes('NOTA DE CREDITO') || subjectUpper.includes('NOTA DE CRÉDITO')) tipoDocumento = 'NOTA DE CREDITO';
    else if (subjectUpper.includes('NOTA DE DEBITO') || subjectUpper.includes('NOTA DE DÉBITO')) tipoDocumento = 'NOTA DE DEBITO';

    // Extract document number — patterns:
    // "CPE FACTURA ELECTRONICA F001-00039306 / 39307"
    // "CPE GUIA DE REMISION - REMITENTE T002-00032256"
    let numeroDocumento = '';
    const match = subject.match(/([A-Z]\d{2,3}-\d{5,}(?:\s*\/\s*\d+)*)/i);
    if (match) numeroDocumento = match[1].trim();

    return { tipoDocumento, numeroDocumento };
  },

  /**
   * Parse email body to extract client name and emission date.
   */
  parseFacturacionBody(body: string, preview?: string): { cliente: string; fechaEmision: string; rucCliente: string; numeroDocumento: string } {
    const rawHtml = (body || '') + '\n' + (preview || '');
    // Strip HTML tags for cleaner matching
    const text = rawHtml.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
    let cliente = '';
    let fechaEmision = '';
    let rucCliente = '';
    let numeroDocumento = '';

    // Extract canonical document number from body — covers cases where subject only has trailing digits
    // Patterns supported: "F001-00039687", "T002-00032256", "BB01-12345", optional "/ 39688" suffix
    const docMatch = text.match(/([A-Z]{1,3}\d{2,3}-\d{5,})(?:\s*\/\s*\d+)?/);
    if (docMatch) numeroDocumento = docMatch[0].trim();

    // Format 1: "Estimado Cliente NOMBRE COMPLETO," — name inline after "Cliente"
    const clientMatch = text.match(/Estimado\s+Cliente\s+([^,.\n]{3,80}?)\s*[,.]/i);
    if (clientMatch) {
      const name = clientMatch[1].trim().replace(/[\s.]+$/, '');
      // Reject if it looks like body prose rather than a company/person name.
      // Real names are mostly UPPERCASE or Title Case — sentence prose contains
      // lowercase function words ("se", "que", "el", "informamos", etc).
      const looksLikeProse = /\b(se les|comunica|informamos|que el|adjunt|hemos|enviad|recib|sirv|hace de|por medio|presente)\b/i.test(name);
      const hasUpperLetters = /[A-ZÁÉÍÓÚÑ]/.test(name);
      const tooLong = name.length > 80;
      if (name.length > 2 && hasUpperLetters && !looksLikeProse && !tooLong) {
        cliente = name;
      }
    }

    // Format 2/3: "RUC CLIENTE: XXXXXXXXXXX" — extract RUC for DB lookup
    const rucMatch = text.match(/RUC\s+CLIENTE[:\s]+(\d{8,11})/i);
    if (rucMatch) rucCliente = rucMatch[1];

    // Emission date: "FECHA EMISION: 2026-03-24"
    const dateMatch = text.match(/FECHA\s+EMISION[:\s]+(\d{4}-\d{2}-\d{2})/i);
    if (dateMatch) fechaEmision = dateMatch[1];

    return { cliente, fechaEmision, rucCliente, numeroDocumento };
  },

  /**
   * Get billing emails from facturacion mailbox Sent Items.
   * Supports pagination with $skip and $filter.
   */
  async getFacturacionEmails(params: {
    top?: number;
    skip?: number;
    fechaDesde?: string;
    fechaHasta?: string;
    search?: string;
  }): Promise<{ emails: any[]; totalCount: number }> {
    if (!this.isConfigured()) {
      console.warn('Graph API not configured');
      return { emails: [], totalCount: 0 };
    }

    try {
      const mailbox = encodeURIComponent(config.facturacionEmail);
      const top = params.top || 25;
      const skip = params.skip || 0;

      let url = `/users/${mailbox}/mailFolders/SentItems/messages?$top=${top}&$skip=${skip}&$orderby=sentDateTime desc&$select=id,subject,toRecipients,ccRecipients,sentDateTime,bodyPreview,body,hasAttachments&$count=true`;

      const filters: string[] = [];
      if (params.fechaDesde) {
        filters.push(`sentDateTime ge ${params.fechaDesde}T00:00:00Z`);
      }
      if (params.fechaHasta) {
        filters.push(`sentDateTime le ${params.fechaHasta}T23:59:59Z`);
      }
      if (filters.length) {
        url += `&$filter=${encodeURIComponent(filters.join(' and '))}`;
      }
      if (params.search) {
        url += `&$search="${encodeURIComponent(params.search)}"`;
      }

      const data = await graphRequest(url);
      const emails = (data.value || []).map((msg: any) => {
        const subjectParse = this.parseFacturacionSubject(msg.subject);
        const { cliente, fechaEmision, rucCliente, numeroDocumento: bodyNumero } = this.parseFacturacionBody(msg.body?.content || '', msg.bodyPreview || '');
        const tipoDocumento = subjectParse.tipoDocumento;
        const numeroDocumento = subjectParse.numeroDocumento || bodyNumero || '';

        return {
          id: msg.id,
          subject: msg.subject,
          to: (msg.toRecipients || []).map((r: any) => r.emailAddress?.address).filter(Boolean),
          cc: (msg.ccRecipients || []).map((r: any) => r.emailAddress?.address).filter(Boolean),
          destinatarios: [...(msg.toRecipients || []), ...(msg.ccRecipients || [])].map((r: any) => r.emailAddress?.address).filter(Boolean),
          sentDateTime: msg.sentDateTime,
          tipoDocumento,
          numeroDocumento,
          rucCliente: rucCliente || '',
          cliente: (() => {
            // 1. Body parse result (best — "Estimado Cliente NOMBRE,")
            if (cliente) return cliente;
            // 2. Recipient display name (only if it's a real name, not an email)
            const recipName = msg.toRecipients?.[0]?.emailAddress?.name || '';
            if (recipName && !recipName.includes('@')) return recipName;
            // 3. Fallback empty — will be resolved by RUC lookup below
            return '';
          })(),
          fechaEmision: fechaEmision || msg.sentDateTime?.split('T')[0] || '',
          hasAttachments: msg.hasAttachments,
          preview: msg.bodyPreview,
        };
      });

      // Resolve empty cliente names via RUC lookup from ventas SQL
      const emptyClientes = emails.filter((e: any) => !e.cliente && e.rucCliente);
      if (emptyClientes.length > 0) {
        try {
          const { getDbPool, sql: mssql } = require('../config/database');
          const pool = await getDbPool();
          const rucs: string[] = Array.from(new Set(emptyClientes.map((e: any) => String(e.rucCliente))));
          const rucLookup: Record<string, string> = {};
          for (const ruc of rucs) {
            const res = await pool.request().input('ruc', mssql.NVarChar, ruc).query(
              `SELECT TOP 1 Razon_Social_Cliente FROM dbo.stg_rpt_ventas_detallado WHERE RUC_Cliente = @ruc AND Razon_Social_Cliente IS NOT NULL`
            );
            if (res.recordset.length > 0) rucLookup[ruc] = res.recordset[0].Razon_Social_Cliente;
          }
          for (const e of emails) {
            if (!e.cliente && e.rucCliente && rucLookup[e.rucCliente]) {
              e.cliente = rucLookup[e.rucCliente];
            }
          }
        } catch (dbErr) {
          console.error('RUC lookup failed (non-critical):', (dbErr as any).message);
        }
      }

      // Cross-reference: build email→cliente map from emails that DO have a name
      const emailToCliente: Record<string, string> = {};
      for (const e of emails) {
        if (e.cliente && !e.cliente.includes('@')) {
          for (const addr of (e.to || [])) {
            if (addr && !emailToCliente[addr.toLowerCase()]) {
              emailToCliente[addr.toLowerCase()] = e.cliente;
            }
          }
        }
      }

      // Apply cross-reference to emails still missing cliente
      for (const e of emails) {
        if (!e.cliente || e.cliente.includes('@')) {
          for (const addr of (e.to || [])) {
            const resolved = emailToCliente[addr.toLowerCase()];
            if (resolved) {
              e.cliente = resolved;
              break;
            }
          }
        }
      }

      // Final fallback: email address only if nothing else worked
      for (const e of emails) {
        if (!e.cliente) {
          e.cliente = e.to?.[0] || '';
        }
      }

      return { emails, totalCount: data['@odata.count'] || emails.length };
    } catch (error) {
      console.error('Error fetching facturacion emails:', error);
      return { emails: [], totalCount: 0 };
    }
  },

  /**
   * Get attachments for a specific billing email (PDFs, XMLs).
   */
  async getFacturacionAttachments(messageId: string): Promise<any[]> {
    if (!this.isConfigured()) return [];

    try {
      const mailbox = encodeURIComponent(config.facturacionEmail);
      const data = await graphRequest(`/users/${mailbox}/messages/${messageId}/attachments`);
      return (data.value || []).map((att: any) => ({
        id: att.id,
        name: att.name,
        contentType: att.contentType,
        size: att.size,
        isInline: att.isInline,
      }));
    } catch (error) {
      console.error('Error fetching attachments:', error);
      return [];
    }
  },

  /**
   * Download a specific attachment (returns base64 content).
   */
  async downloadFacturacionAttachment(messageId: string, attachmentId: string): Promise<{ name: string; contentType: string; contentBytes: string } | null> {
    if (!this.isConfigured()) return null;

    try {
      const mailbox = encodeURIComponent(config.facturacionEmail);
      const data = await graphRequest(`/users/${mailbox}/messages/${messageId}/attachments/${attachmentId}`);
      return {
        name: data.name,
        contentType: data.contentType,
        contentBytes: data.contentBytes, // base64
      };
    } catch (error) {
      console.error('Error downloading attachment:', error);
      return null;
    }
  },

  // ---- LETRAS (SharePoint) ----
  async getLetrasFiles(params?: { search?: string }) {
    const DRIVE_ID = 'b!aDBAYXgyCUifG71OViKVOiShCsAuAlVOqAljzYTa1vGXuJpv-DDtTZw_GIbFTKRX';
    const FOLDER_ID = '01KKJOPMODLHUOCZVMZ5AKFBNXAYTMIBX4';

    try {
      let url = `/drives/${DRIVE_ID}/items/${FOLDER_ID}/children?$top=200&$orderby=lastModifiedDateTime desc&$select=id,name,size,lastModifiedDateTime,createdDateTime,file,webUrl,@microsoft.graph.downloadUrl`;

      if (params?.search) {
        // Use search endpoint instead
        url = `/drives/${DRIVE_ID}/items/${FOLDER_ID}/search(q='${encodeURIComponent(params.search)}')?$top=200&$select=id,name,size,lastModifiedDateTime,createdDateTime,file,webUrl,@microsoft.graph.downloadUrl`;
      }

      const data = await graphRequest(url);
      const files = (data.value || [])
        .filter((f: any) => f.file && f.name.toLowerCase().endsWith('.pdf'))
        .map((f: any) => {
          const parsed = this.parseLetraFilename(f.name);
          return {
            id: f.id,
            name: f.name,
            letras: parsed.letras,
            facturaCode: parsed.facturaCode,
            downloadUrl: f['@microsoft.graph.downloadUrl'] || '',
            webUrl: f.webUrl || '',
            lastModified: f.lastModifiedDateTime,
            created: f.createdDateTime,
            size: f.size || 0,
          };
        });

      return files;
    } catch (error) {
      console.error('Error fetching letras files from SharePoint:', error);
      return [];
    }
  },

  parseLetraFilename(name: string): { letras: string[]; facturaCode: string } {
    // Patterns:
    // "LT 679-680 - F001-00039659.pdf"
    // "LT 685-686-687 F001-00039670.pdf"
    // "LT 692-693-694-695-696-697 - F001-000..."
    // "LT 691 - F001-00039681.pdf"
    const clean = name.replace(/\.pdf$/i, '').trim();

    // Extract letra numbers: everything between "LT " and the first "F0" or " - F"
    const letraMatch = clean.match(/^LT\s+([\d\s\-]+?)[\s\-]*(?:F\d|$)/i);
    let letras: string[] = [];
    if (letraMatch) {
      letras = letraMatch[1].trim().split(/\s*-\s*/).filter(Boolean);
    }

    // Extract factura code(s): F001-XXXXXXXX pattern(s)
    const facturaMatches = clean.match(/F\d{3}-\d{5,}/g) || [];
    const facturaCode = facturaMatches.join(' / ');

    return { letras, facturaCode };
  },

  // ---- SEND EMAIL WITH ATTACHMENTS ----
  async sendEmailWithAttachments(params: {
    to: string[];
    cc?: string[];
    subject: string;
    bodyHtml: string;
    attachments: Array<{ name: string; contentType: string; contentBytes: string }>;
  }) {
    const mailbox = process.env.MS_FACTURACION_EMAIL || 'facturacionpointandina@pointamericas.com';
    const message: any = {
      subject: params.subject,
      body: { contentType: 'HTML', content: params.bodyHtml },
      toRecipients: params.to.map(email => ({ emailAddress: { address: email } })),
      attachments: params.attachments.map(att => ({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: att.name,
        contentType: att.contentType,
        contentBytes: att.contentBytes,
      })),
    };
    if (params.cc && params.cc.length > 0) {
      message.ccRecipients = params.cc.map(email => ({ emailAddress: { address: email } }));
    }

    return graphPost(`/users/${mailbox}/sendMail`, { message, saveToSentItems: true });
  },

  // ---- DOWNLOAD SHAREPOINT FILE ----
  async downloadDriveItem(driveId: string, itemId: string): Promise<{ contentBytes: string; name: string }> {
    const meta = await graphRequest(`/drives/${driveId}/items/${itemId}?$select=name,file`);
    const buffer = await graphGetRaw(`/drives/${driveId}/items/${itemId}/content`);
    return {
      name: meta.name,
      contentBytes: buffer.toString('base64'),
    };
  },
};
