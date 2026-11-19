import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  BOOTSTRAPPED_ADMIN_EMAIL,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import { AlbaUser, CustomerProfile, UserRole } from '../types/alba';

interface AuthContextValue {
  firebaseUser: User | null;
  albaUser: AlbaUser | null;
  profile: CustomerProfile | null;
  loading: boolean;
  isSuperAdmin: boolean;
  isPartner: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (params: {
    fullName: string;
    email: string;
    password: string;
    city: string;
  }) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshAuthUser: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [albaUser, setAlbaUser] = useState<AlbaUser | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const syncUserDocument = async (user: User, preferredCity = 'Bengaluru') => {
    const userRef = doc(db, 'users', user.uid);
    const profileRef = doc(db, 'customer_profiles', user.uid);
    const isAdminEmail =
      user.email === BOOTSTRAPPED_ADMIN_EMAIL && user.emailVerified;

    try {
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        const defaultRole: UserRole = isAdminEmail ? 'super_admin' : 'customer';
        const newUser: AlbaUser = {
          uid: user.uid,
          fullName: user.displayName || user.email?.split('@')[0] || 'Alba Explorer',
          email: user.email || '',
          role: defaultRole,
          city: preferredCity,
          emailVerified: user.emailVerified,
          isDeleted: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(userRef, newUser);
        setAlbaUser(newUser);
      } else {
        const existing = snap.data() as AlbaUser;
        if (existing.emailVerified !== user.emailVerified) {
          await updateDoc(userRef, {
            emailVerified: user.emailVerified,
            updatedAt: serverTimestamp(),
          });
        }
        setAlbaUser({
          ...existing,
          role: isAdminEmail ? 'super_admin' : existing.role,
          emailVerified: user.emailVerified,
        });
      }

      const profSnap = await getDoc(profileRef);
      if (!profSnap.exists()) {
        const newProf: CustomerProfile = {
          userId: user.uid,
          fullName: user.displayName || user.email?.split('@')[0] || 'Alba Explorer',
          email: user.email || '',
          phone: '',
          city: preferredCity,
          interests: ['Adventure', 'Rooftop Dining'],
          preferredActivities: ['Go-Karting', 'Weekend Getaways'],
          typicalGroupSize: 6,
          budgetPreference: 2000,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(profileRef, newProf);
        setProfile(newProf);
      } else {
        setProfile(profSnap.data() as CustomerProfile);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          await syncUserDocument(user);
        } catch (err) {
          console.error('Error syncing user profile:', err);
        }
      } else {
        setAlbaUser(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const signInWithGoogle = async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    await syncUserDocument(cred.user);
  };

  const signInWithEmail = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await syncUserDocument(cred.user);
  };

  const registerWithEmail = async (params: {
    fullName: string;
    email: string;
    password: string;
    city: string;
  }) => {
    const cred = await createUserWithEmailAndPassword(auth, params.email, params.password);
    await updateProfile(cred.user, { displayName: params.fullName });
    await sendEmailVerification(cred.user);
    await syncUserDocument(cred.user, params.city);
  };

  const resendVerificationEmail = async () => {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  };

  const refreshAuthUser = async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      setFirebaseUser(auth.currentUser);
      await syncUserDocument(auth.currentUser);
    }
  };

  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    await signOut(auth);
    setAlbaUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (!auth.currentUser) return;
    await syncUserDocument(auth.currentUser);
  };

  const isSuperAdmin =
    Boolean(firebaseUser?.emailVerified) &&
    (firebaseUser?.email === BOOTSTRAPPED_ADMIN_EMAIL || albaUser?.role === 'super_admin');

  const isPartner = albaUser?.role === 'venue_partner';

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        albaUser,
        profile,
        loading,
        isSuperAdmin,
        isPartner,
        signInWithGoogle,
        signInWithEmail,
        registerWithEmail,
        resendVerificationEmail,
        refreshAuthUser,
        sendPasswordReset,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
