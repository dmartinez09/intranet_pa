import * as msal from '@azure/msal-node';

// ============================================================
// AZURE DATA FACTORY SERVICE
// Triggers the FPL_Estado_cuenta pipeline with pFechaCorte param
// ============================================================

const config = {
  tenantId: process.env.MS_TENANT_ID || '',
  clientId: process.env.MS_CLIENT_ID || '',
  clientSecret: process.env.MS_CLIENT_SECRET || '',
  subscriptionId: process.env.ADF_SUBSCRIPTION_ID || '',
  resourceGroup: process.env.ADF_RESOURCE_GROUP || '',
  factoryName: process.env.ADF_FACTORY_NAME || 'df-pointandina-prod',
  pipelineName: process.env.ADF_PIPELINE_NAME || 'FPL_Estado_cuenta',
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

async function getManagementToken(): Promise<string> {
  const client = getMsalClient();
  const result = await client.acquireTokenByClientCredential({
    scopes: ['https://management.azure.com/.default'],
  });
  if (!result?.accessToken) throw new Error('Failed to acquire Azure Management token');
  return result.accessToken;
}

function isConfigured(): boolean {
  return !!(config.subscriptionId && config.resourceGroup && config.factoryName && config.clientId && config.clientSecret);
}

function getBaseUrl(): string {
  return `https://management.azure.com/subscriptions/${config.subscriptionId}/resourceGroups/${config.resourceGroup}/providers/Microsoft.DataFactory/factories/${config.factoryName}`;
}

export const adfService = {
  isConfigured,

  /**
   * Trigger pipeline FPL_Estado_cuenta with pFechaCorte parameter.
   * Returns the pipeline run ID for status polling.
   */
  async triggerPipeline(fechaCorte: string): Promise<string> {
    if (!isConfigured()) {
      throw new Error('Azure Data Factory no está configurado. Verifique las variables ADF_SUBSCRIPTION_ID, ADF_RESOURCE_GROUP en .env');
    }

    const token = await getManagementToken();
    const url = `${getBaseUrl()}/pipelines/${config.pipelineName}/createRun?api-version=2018-06-01`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pFechaCorte: fechaCorte,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Data Factory error ${response.status}: ${text}`);
    }

    const data: any = await response.json();
    return data.runId;
  },

  /**
   * Check pipeline run status.
   * Returns status: Queued, InProgress, Succeeded, Failed, Cancelling, Cancelled
   */
  async getPipelineStatus(runId: string): Promise<{ status: string; message: string }> {
    if (!isConfigured()) {
      throw new Error('Azure Data Factory no está configurado');
    }

    const token = await getManagementToken();
    const url = `${getBaseUrl()}/pipelineruns/${runId}?api-version=2018-06-01`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Data Factory error ${response.status}: ${text}`);
    }

    const data: any = await response.json();
    return {
      status: data.status,
      message: data.message || '',
    };
  },
};
