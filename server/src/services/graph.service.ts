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
  parseFacturacionBody(body: string, preview?: string): { cliente: string; fechaEmision: string } {
    const text = (body || '') + '\n' + (preview || '');
    let cliente = '';
    let fechaEmision = '';

    // Client: "Estimado Cliente TERRONES ZAMORA BLANCA OLIBETH,"
    // Skip if just "Estimado Cliente," with no name
    const clientMatch = text.match(/Estimado\s+Cliente\s+([A-ZÁÉÍÓÚÑ][^,<\n]{2,})/i);
    if (clientMatch) cliente = clientMatch[1].trim();

    // Emission date: "FECHA EMISION: 2026-03-24" or "FECHA EMISION:2026-03-24"
    const dateMatch = text.match(/FECHA\s+EMISION[:\s]+(\d{4}-\d{2}-\d{2})/i);
    if (dateMatch) fechaEmision = dateMatch[1];

    return { cliente, fechaEmision };
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
        const { tipoDocumento, numeroDocumento } = this.parseFacturacionSubject(msg.subject);
        const { cliente, fechaEmision } = this.parseFacturacionBody(msg.body?.content || '', msg.bodyPreview || '');

        return {
          id: msg.id,
          subject: msg.subject,
          to: (msg.toRecipients || []).map((r: any) => r.emailAddress?.address).filter(Boolean),
          cc: (msg.ccRecipients || []).map((r: any) => r.emailAddress?.address).filter(Boolean),
          sentDateTime: msg.sentDateTime,
          tipoDocumento,
          numeroDocumento,
          cliente: cliente || (msg.toRecipients?.[0]?.emailAddress?.name || ''),
          fechaEmision: fechaEmision || msg.sentDateTime?.split('T')[0] || '',
          hasAttachments: msg.hasAttachments,
          preview: msg.bodyPreview,
        };
      });

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
};
