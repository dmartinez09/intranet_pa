import * as msal from '@azure/msal-node';

/**
 * Servicio de SharePoint vía Microsoft Graph API.
 * Soporta:
 *  - Resolver site/drive a partir de URL de SharePoint
 *  - Listar contenido de carpetas (folder picker)
 *  - Subir / sobrescribir archivos
 *  - Descargar archivos
 *  - Verificar existencia
 */

const config = {
  tenantId: process.env.MS_TENANT_ID || '',
  clientId: process.env.MS_CLIENT_ID || '',
  clientSecret: process.env.MS_CLIENT_SECRET || '',
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

async function getToken(): Promise<string> {
  const client = getMsalClient();
  const r = await client.acquireTokenByClientCredential({
    scopes: ['https://graph.microsoft.com/.default'],
  });
  if (!r?.accessToken) throw new Error('Failed to acquire Graph token');
  return r.accessToken;
}

const GRAPH = 'https://graph.microsoft.com/v1.0';

async function gget(path: string): Promise<any> {
  const token = await getToken();
  const r = await fetch(`${GRAPH}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Graph GET ${path} → ${r.status} ${await r.text()}`);
  return r.json();
}

async function ggetRaw(path: string): Promise<Buffer | null> {
  const token = await getToken();
  const r = await fetch(`${GRAPH}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Graph GET ${path} → ${r.status} ${await r.text()}`);
  return Buffer.from(await r.arrayBuffer());
}

async function gput(path: string, body: Buffer | string, contentType: string): Promise<any> {
  const token = await getToken();
  const r = await fetch(`${GRAPH}${path}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
    body: body as any,
  });
  if (!r.ok) throw new Error(`Graph PUT ${path} → ${r.status} ${await r.text()}`);
  return r.json();
}

// ============================================================
// Resolución URL SharePoint -> site / drive / folder
// ============================================================

export interface SpLocation {
  hostname: string;
  sitePath: string;        // /Uruguay
  folderPath: string;      // /Carpetas Individuales/.../Ventas diarias Point Andina
  raw: string;
}

/**
 * Parsea una URL de SharePoint en sus partes navegables.
 * Acepta:
 *  https://pointamericas.sharepoint.com/Uruguay/Carpetas%20Individuales/.../Ventas%20diarias%20Point%20Andina
 *  https://pointamericas.sharepoint.com/Uruguay/Carpetas%20Individuales/Forms/AllItems.aspx?id=%2FUruguay%2F...
 */
export function parseSharePointUrl(url: string): SpLocation {
  const u = new URL(url);
  const hostname = u.hostname; // pointamericas.sharepoint.com

  // Caso AllItems.aspx?id=...
  const idParam = u.searchParams.get('id');
  if (idParam) {
    const decoded = decodeURIComponent(idParam);          // /Uruguay/Carpetas Individuales/...
    const parts = decoded.split('/').filter(Boolean);
    const sitePath = '/' + parts[0];                       // /Uruguay
    const folderPath = '/' + parts.slice(1).join('/');     // /Carpetas Individuales/...
    return { hostname, sitePath, folderPath, raw: url };
  }

  // Caso path directo
  const decoded = decodeURIComponent(u.pathname);
  const parts = decoded.split('/').filter(Boolean);
  if (parts.length === 0) throw new Error('URL SharePoint inválida');
  const sitePath = '/' + parts[0];
  const folderPath = parts.length > 1 ? '/' + parts.slice(1).join('/') : '/';
  return { hostname, sitePath, folderPath, raw: url };
}

// ============================================================
// API pública
// ============================================================

export const sharepointService = {
  isConfigured(): boolean {
    return !!(config.tenantId && config.clientId && config.clientSecret);
  },

  /** Resuelve siteId a partir de hostname + sitePath. */
  async resolveSite(hostname: string, sitePath: string): Promise<{ id: string; webUrl: string; displayName: string }> {
    const r = await gget(`/sites/${hostname}:${sitePath}`);
    return { id: r.id, webUrl: r.webUrl, displayName: r.displayName };
  },

  /** Sitio raíz del tenant. */
  async getRootSite(hostname: string): Promise<{ id: string; webUrl: string; displayName: string }> {
    const r = await gget(`/sites/${hostname}`);
    return { id: r.id, webUrl: r.webUrl, displayName: r.displayName };
  },

  /** Lista todas las bibliotecas (drives) de un sitio. */
  async listDrives(siteId: string): Promise<Array<{ id: string; name: string; webUrl: string }>> {
    const r = await gget(`/sites/${siteId}/drives?$top=200`);
    return (r.value || []).map((d: any) => ({ id: d.id, name: d.name, webUrl: d.webUrl }));
  },

  /** Devuelve el drive raíz del sitio. */
  async getDefaultDrive(siteId: string): Promise<{ id: string; name: string }> {
    const r = await gget(`/sites/${siteId}/drive`);
    return { id: r.id, name: r.name };
  },

  /** Lista hijos (carpetas + archivos) de una ruta dentro de un drive. */
  async listChildren(driveId: string, folderPath = '/'): Promise<Array<{
    id: string; name: string; folder: boolean; size: number; webUrl: string; lastModified: string;
  }>> {
    const path = folderPath === '/' || folderPath === ''
      ? `/drives/${driveId}/root/children?$top=200`
      : `/drives/${driveId}/root:${encodeURI(folderPath)}:/children?$top=200`;
    const r = await gget(path);
    return (r.value || []).map((it: any) => ({
      id: it.id,
      name: it.name,
      folder: !!it.folder,
      size: it.size || 0,
      webUrl: it.webUrl,
      lastModified: it.lastModifiedDateTime,
    }));
  },

  /** Descarga contenido de un archivo. Retorna null si no existe. */
  async downloadFile(driveId: string, filePath: string): Promise<Buffer | null> {
    const path = `/drives/${driveId}/root:${encodeURI(filePath)}:/content`;
    return await ggetRaw(path);
  },

  /** Sube/sobrescribe archivo (<4MB simple upload). */
  async uploadFile(driveId: string, filePath: string, content: Buffer, contentType: string): Promise<{ id: string; webUrl: string; size: number; }> {
    const path = `/drives/${driveId}/root:${encodeURI(filePath)}:/content`;
    const r = await gput(path, content, contentType);
    return { id: r.id, webUrl: r.webUrl, size: r.size };
  },

  /**
   * Resuelve URL SharePoint -> { siteId, driveId, folderPath } listo para usar.
   * Estrategia (probada en orden):
   *  1) Si parts[0]='sites': site collection /sites/<name>/<library>/...
   *  2) parts[0] como SUBSITIO del root: /<subsite>/<library>/...   (caso Uruguay)
   *  3) parts[0] como BIBLIOTECA del root: /<library>/...
   */
  async resolveLocation(url: string): Promise<{
    siteId: string; driveId: string; folderPath: string; webUrl: string; siteName: string;
  }> {
    const loc = parseSharePointUrl(url);
    const decoded = (loc.sitePath + (loc.folderPath === '/' ? '' : loc.folderPath));
    const parts = decoded.split('/').filter(Boolean);

    const findDrive = (drives: Array<{ id: string; name: string; webUrl: string }>, name: string) =>
      drives.find(d =>
        d.name === name ||
        (d.webUrl || '').toLowerCase().endsWith('/' + name.toLowerCase())
      );

    // ---- Caso 1: site collection /sites/<name>/<library>/... ----
    if (parts[0]?.toLowerCase() === 'sites' && parts.length >= 2) {
      const siteSegment = '/sites/' + parts[1];
      const site = await this.resolveSite(loc.hostname, siteSegment);
      if (parts.length >= 3) {
        const drives = await this.listDrives(site.id);
        const found = findDrive(drives, parts[2]);
        if (found) {
          return {
            siteId: site.id, driveId: found.id,
            folderPath: parts.length > 3 ? '/' + parts.slice(3).join('/') : '/',
            webUrl: site.webUrl, siteName: site.displayName,
          };
        }
      }
      const def = await this.getDefaultDrive(site.id);
      return { siteId: site.id, driveId: def.id, folderPath: '/', webUrl: site.webUrl, siteName: site.displayName };
    }

    if (parts.length === 0) {
      const rootSite = await this.getRootSite(loc.hostname);
      const def = await this.getDefaultDrive(rootSite.id);
      return { siteId: rootSite.id, driveId: def.id, folderPath: '/', webUrl: rootSite.webUrl, siteName: rootSite.displayName };
    }

    // ---- Caso 2: SUBSITIO del root /<subsite>/<library>/... ----
    let subsiteErr: any = null;
    try {
      const sub = await this.resolveSite(loc.hostname, '/' + parts[0]);
      const subDrives = await this.listDrives(sub.id);
      if (subDrives.length > 0) {
        // Si hay biblioteca explícita después del subsitio, matchearla
        if (parts.length >= 2) {
          const found = findDrive(subDrives, parts[1]);
          if (found) {
            return {
              siteId: sub.id, driveId: found.id,
              folderPath: parts.length > 2 ? '/' + parts.slice(2).join('/') : '/',
              webUrl: sub.webUrl, siteName: sub.displayName,
            };
          }
        }
        // Fallback: primer drive de "Documentos"/"Documents" o el primero
        const docDrive = subDrives.find(d => /^document(o)?s$/i.test(d.name)) || subDrives[0];
        return {
          siteId: sub.id, driveId: docDrive.id,
          folderPath: parts.length > 1 ? '/' + parts.slice(1).join('/') : '/',
          webUrl: sub.webUrl, siteName: sub.displayName,
        };
      }
    } catch (e: any) { subsiteErr = e; }

    // ---- Caso 3: BIBLIOTECA del root /<library>/... ----
    const rootSite = await this.getRootSite(loc.hostname);
    const drives = await this.listDrives(rootSite.id);
    const found = findDrive(drives, parts[0]);
    if (found) {
      return {
        siteId: rootSite.id, driveId: found.id,
        folderPath: parts.length > 1 ? '/' + parts.slice(1).join('/') : '/',
        webUrl: rootSite.webUrl, siteName: rootSite.displayName,
      };
    }
    throw new Error(
      `No se pudo resolver "${parts[0]}" ni como subsitio ni como biblioteca. ` +
      `Bibliotecas raíz: ${drives.map(d => d.name).join(', ')}` +
      (subsiteErr ? ` | Subsitio: ${subsiteErr.message}` : '')
    );
  },
};
