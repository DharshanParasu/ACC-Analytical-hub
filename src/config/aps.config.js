// Autodesk Platform Services Configuration
// Get your credentials from: https://aps.autodesk.com/

// Helper to get config with overrides
const getStoredConfig = () => {
    const customId = localStorage.getItem('custom_aps_client_id');
    const customSecret = localStorage.getItem('custom_aps_client_secret');
    const customCallback = localStorage.getItem('custom_aps_callback_url');

    return {
        // Prioritize local storage, then env, then placeholder
        clientId: customId || import.meta.env.VITE_APS_CLIENT_ID || 'YOUR_CLIENT_ID_HERE',
        clientSecret: customSecret || import.meta.env.VITE_APS_CLIENT_SECRET || 'YOUR_CLIENT_SECRET_HERE',
        callbackUrl: customCallback || import.meta.env.VITE_APS_REDIRECT_URL || `${window.location.origin}/api/auth/callback`,
        scopes: ['data:read', 'viewables:read'],
        environment: 'AutodeskProduction'
    };
};

export const apsConfig = getStoredConfig();

// Example model URNs (replace with your actual model URNs from ACC)
export const sampleModels = {
    // Format: 'urn:dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6...'
    example1: 'YOUR_MODEL_URN_HERE',
    example2: 'YOUR_MODEL_URN_HERE'
};

// Instructions:
// 1. Go to https://aps.autodesk.com/
// 2. Create an application to get Client ID and Secret
// 3. Replace the placeholders above with your actual credentials
// 4. To get model URNs from ACC:
//    - Use the APS Data Management API
//    - Or use the ACC UI to get the model URN
//    - The URN should be base64 encoded

export default apsConfig;
