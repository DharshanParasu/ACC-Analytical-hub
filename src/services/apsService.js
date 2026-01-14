// APS Service for Autodesk Platform Services integration
import apsConfig from '../config/aps.config';

class APSService {
    constructor() {
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    // --- 3-Legged OAuth Methods ---

    login() {
        const { clientId, callbackUrl, scopes } = apsConfig;
        const url = `https://developer.api.autodesk.com/authentication/v2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=${encodeURIComponent(scopes.join(' '))}`;
        window.location.assign(url);
    }

    async setDirectToken(token) {
        if (token) {
            this.accessToken = token;
            // Set a generous expiry for manual tokens (1 hour)
            this.tokenExpiry = Date.now() + (3600 * 1000);
            return true;
        }
        return false;
    }

    async handleCallback() {
        const query = window.location.search.substring(1);
        const params = new URLSearchParams(query);
        const code = params.get('code');

        if (code) {
            const { clientId, clientSecret, callbackUrl } = apsConfig;

            try {
                const response = await fetch('https://developer.api.autodesk.com/authentication/v2/token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Accept': 'application/json'
                    },
                    body: new URLSearchParams({
                        'grant_type': 'authorization_code',
                        'code': code,
                        'client_id': clientId,
                        'client_secret': clientSecret,
                        'redirect_uri': callbackUrl
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    console.error('Failed to exchange code for token:', error);
                    return false;
                }

                const data = await response.json();
                this.accessToken = data.access_token;
                this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;

                // Clear query params and redirect to root
                window.history.replaceState(null, null, '/');
                return true;
            } catch (error) {
                console.error('Error during token exchange:', error);
                return false;
            }
        }
        return false;
    }

    async getUserProfile() {
        const token = await this.getAccessToken();
        if (!token) return null;
        try {
            const response = await fetch('https://developer.api.autodesk.com/userprofile/v1/userinfo', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            console.error('Error fetching user profile:', error);
            return null;
        }
    }

    // Get access token (prioritizes 3-legged user token)
    async getAccessToken() {
        // Check if we already have a valid token
        if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            return this.accessToken;
        }

        // For dashboard usage, we usually rely on the token already being present via handleCallback
        // If not, we might need to fall back to 2-legged for public models, but here we assume user-auth
        return this.accessToken;
    }

    // --- Data Management API Methods ---

    async getHubs() {
        const token = await this.getAccessToken();
        if (!token) throw new Error('Not authenticated');
        const response = await fetch('https://developer.api.autodesk.com/project/v1/hubs', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch hubs');
        const data = await response.json();
        return data.data;
    }

    async getProjects(hubId) {
        const token = await this.getAccessToken();
        if (!token) throw new Error('Not authenticated');
        const response = await fetch(`https://developer.api.autodesk.com/project/v1/hubs/${hubId}/projects`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch projects');
        const data = await response.json();
        return data.data;
    }

    async getTopFolders(hubId, projectId) {
        const token = await this.getAccessToken();
        if (!token) throw new Error('Not authenticated');
        const response = await fetch(`https://developer.api.autodesk.com/project/v1/hubs/${hubId}/projects/${projectId}/topFolders`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch top folders');
        const data = await response.json();
        return data.data;
    }

    async getFolderContents(projectId, folderId) {
        const token = await this.getAccessToken();
        if (!token) throw new Error('Not authenticated');
        const response = await fetch(`https://developer.api.autodesk.com/data/v1/projects/${projectId}/folders/${folderId}/contents`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch folder contents');
        const data = await response.json();
        return data.data;
    }

    // Get model metadata
    async getModelMetadata(modelUrn) {
        const token = await this.getAccessToken();
        if (!token) throw new Error('No access token available');

        try {
            // Call APS API to get model metadata
            const response = await fetch(
                `https://developer.api.autodesk.com/modelderivative/v2/designdata/${modelUrn}/metadata`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Failed to fetch model metadata');
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching model metadata:', error);
            throw error;
        }
    }

    // Extract properties from model for analytics
    async extractModelProperties(modelUrn) {
        try {
            const metadata = await this.getModelMetadata(modelUrn);

            // Process metadata to extract useful properties
            // This is where you would parse the model data
            // and create datasets for charts

            return {
                materials: this.extractMaterials(metadata),
                costs: this.extractCosts(metadata),
                quantities: this.extractQuantities(metadata)
            };
        } catch (error) {
            console.error('Error extracting model properties:', error);
            return null;
        }
    }

    // Helper methods to extract specific data
    extractMaterials(metadata) {
        // Parse metadata to extract material information
        // Return data suitable for pie charts
        return {
            labels: ['Concrete', 'Steel', 'Glass', 'Wood', 'Other'],
            data: [35, 25, 15, 15, 10]
        };
    }

    extractCosts(metadata) {
        // Parse metadata to extract cost information
        // Return data suitable for bar charts
        return {
            labels: ['Foundation', 'Structure', 'Walls', 'Roof', 'MEP', 'Finishes'],
            data: [450, 680, 320, 280, 520, 380]
        };
    }

    extractQuantities(metadata) {
        // Parse metadata to extract quantity information
        // Return data suitable for tables
        return {
            headers: ['Component', 'Quantity', 'Material', 'Cost', 'Status'],
            rows: [
                ['Columns', '24', 'Concrete', '$45,000', '✅ Complete'],
                ['Beams', '48', 'Steel', '$68,000', '✅ Complete'],
                ['Walls', '156', 'Brick', '$32,000', '🔄 In Progress']
            ]
        };
    }

    // --- AEC Data Model GraphQL API ---

    async queryAECDataModel(query, variables = {}) {
        const token = await this.getAccessToken();
        if (!token) throw new Error('Not authenticated');

        try {
            const response = await fetch('https://developer.api.autodesk.com/aecdatamodel/v1/graphql', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query, variables })
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorJson;
                try {
                    errorJson = JSON.parse(errorText);
                } catch (e) {
                    errorJson = { message: errorText };
                }
                console.error('[APSService] AEC Data Model API Error:', {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorJson
                });
                throw new Error(`AEC Data Model query failed (${response.status}): ${errorText}`);
            }

            const data = await response.json();
            if (data.errors) {
                console.warn('[APSService] GraphQL Errors:', data.errors);
            }
            return data;
        } catch (error) {
            console.error('[APSService] Error in AEC Data Model query:', error);
            throw error;
        }
    }
}

export const apsService = new APSService();
export default apsService;
