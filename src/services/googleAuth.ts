import * as jose from 'jose';
const SERVICE_ACCOUNT_CONFIG = {
    private_key: import.meta.env.VITE_GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: import.meta.env.VITE_GOOGLE_CLIENT_EMAIL,
    token_uri: import.meta.env.VITE_GOOGLE_TOKEN_URI || "https://oauth2.googleapis.com/token"
};

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

export async function getAccessToken(): Promise<string> {
    try {
        if (!SERVICE_ACCOUNT_CONFIG.private_key || !SERVICE_ACCOUNT_CONFIG.client_email) {
            throw new Error("Missing Google Credential Environment Variables");
        }

        const algorithm = 'RS256';
        const privateKey = await jose.importPKCS8(SERVICE_ACCOUNT_CONFIG.private_key, algorithm);

        const jwt = await new jose.SignJWT({
            scope: SCOPES,
        })
            .setProtectedHeader({ alg: algorithm, typ: 'JWT' })
            .setIssuer(SERVICE_ACCOUNT_CONFIG.client_email)
            .setSubject(SERVICE_ACCOUNT_CONFIG.client_email)
            .setAudience(SERVICE_ACCOUNT_CONFIG.token_uri)
            .setExpirationTime('1h')
            .setIssuedAt()
            .sign(privateKey);

        const response = await fetch(SERVICE_ACCOUNT_CONFIG.token_uri, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion: jwt,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Token request failed: ${errorData.error_description || errorData.error}`);
        }

        const data = await response.json();
        return data.access_token;
    } catch (error) {
        console.error('Failed to get access token:', error);
        throw error;
    }
}
