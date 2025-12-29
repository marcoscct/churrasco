
const APP_PROPERTY_KEY = 'app';
const APP_PROPERTY_VALUE = 'churrasco_manager_v1';

export interface DriveFile {
    id: string;
    name: string;
    createdTime?: string;
    thumbnailLink?: string;
}

export async function listMockBarbecues(token: string): Promise<DriveFile[]> {
    // Search for files with our signature
    const query = `appProperties has { key='${APP_PROPERTY_KEY}' and value='${APP_PROPERTY_VALUE}' } and trashed = false`;

    // We request specific fields for efficiency
    const fields = 'files(id, name, createdTime, thumbnailLink)';
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}`;

    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
        throw new Error('Failed to list files');
    }

    const data = await response.json();
    return data.files || [];
}

export async function createBarbecue(name: string, token: string): Promise<string> {
    const metadata = {
        name: name,
        mimeType: 'application/vnd.google-apps.spreadsheet',
        appProperties: {
            [APP_PROPERTY_KEY]: APP_PROPERTY_VALUE
        }
    };

    const response = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
    });

    if (!response.ok) {
        throw new Error('Failed to create file');
    }

    const data = await response.json();
    return data.id;
}

export async function signFile(fileId: string, token: string): Promise<void> {
    // "Sign" the file by adding our app property
    // This allows us to find it later in the list
    const metadata = {
        appProperties: {
            [APP_PROPERTY_KEY]: APP_PROPERTY_VALUE
        }
    };

    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: 'PATCH',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
    });

    if (!response.ok) {
        throw new Error('Failed to sign file');
    }
}
