import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { googleLogout, useGoogleLogin } from '@react-oauth/google';
import type { TokenResponse } from '@react-oauth/google';
import { SCOPES } from '../config/auth';
import { signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../config/firebase';

// Intercept all fetch calls to detect Google API 401 Unauthorized responses (token expired)
const originalFetch = window.fetch;
window.fetch = async function (input, init) {
    try {
        const response = await originalFetch(input, init);
        if (response.status === 401) {
            let url = '';
            if (typeof input === 'string') {
                url = input;
            } else if (input && typeof input === 'object' && 'url' in input) {
                url = (input as any).url;
            }
            if (url && url.includes('googleapis.com')) {
                window.dispatchEvent(new CustomEvent('google-token-expired'));
            }
        }
        return response;
    } catch (error) {
        throw error;
    }
};

interface UserProfile {
    id: string;
    name: string;
    email: string;
    picture: string;
}

interface AuthContextType {
    user: UserProfile | null;
    token: string | null;
    login: () => void;
    logout: () => void;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const storedToken = sessionStorage.getItem('google_access_token');
        const storedUser = sessionStorage.getItem('google_user');

        if (storedToken && storedUser) {
            setToken(storedToken);
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);

            // Re-authenticate with Firebase Auth on reload
            const credential = GoogleAuthProvider.credential(null, storedToken);
            signInWithCredential(auth, credential).catch(err => {
                console.error("Failed to re-authenticate with Firebase on reload:", err);
            });
        }
        setIsLoading(false);
    }, []);

    const logout = () => {
        googleLogout();
        auth.signOut().catch(err => console.error("Firebase logout error:", err));
        setToken(null);
        setUser(null);
        sessionStorage.removeItem('google_access_token');
        sessionStorage.removeItem('google_user');
    };

    useEffect(() => {
        const handleExpired = () => {
            console.warn("Google Access Token Expired! Logging out...");
            logout();
            alert("Sua sessão expirou por segurança. Por favor, entre novamente para continuar.");
        };

        window.addEventListener('google-token-expired', handleExpired);
        return () => {
            window.removeEventListener('google-token-expired', handleExpired);
        };
    }, []);

    const login = useGoogleLogin({
        onSuccess: async (tokenResponse: TokenResponse) => {
            setToken(tokenResponse.access_token);
            sessionStorage.setItem('google_access_token', tokenResponse.access_token);

            // Fetch User Info
            try {
                const res = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
                    headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                });
                const profile = await res.json();
                const cleanProfile = {
                    id: profile.id,
                    name: profile.name,
                    email: profile.email,
                    picture: profile.picture
                };
                setUser(cleanProfile);
                sessionStorage.setItem('google_user', JSON.stringify(cleanProfile));

                // Authenticate to Firebase Auth using Google Access Token
                const credential = GoogleAuthProvider.credential(null, tokenResponse.access_token);
                await signInWithCredential(auth, credential);
                console.log("Firebase Auth signed in successfully!");
            } catch (error) {
                console.error("Failed to complete Google/Firebase login flow", error);
            }
        },
        onError: error => console.error('Login Failed:', error),
        scope: SCOPES,
        flow: 'implicit'
    });

    return (
        <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
