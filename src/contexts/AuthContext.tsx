
import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { googleLogout, useGoogleLogin } from '@react-oauth/google';
import type { TokenResponse } from '@react-oauth/google';
import { SCOPES } from '../config/auth';

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
            setUser(JSON.parse(storedUser));
        }
        setIsLoading(false);
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
            } catch (error) {
                console.error("Failed to fetch user profile", error);
            }
        },
        onError: error => console.error('Login Failed:', error),
        scope: SCOPES,
        flow: 'implicit'
    });

    const logout = () => {
        googleLogout();
        setToken(null);
        setUser(null);
        sessionStorage.removeItem('google_access_token');
        sessionStorage.removeItem('google_user');
    };

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
