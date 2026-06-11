import {
  Dispatch,
  SetStateAction,
  createContext,
  useCallback,
  useEffect,
  useState,
} from "react";
import { onAuthStateChanged, getAuth, User } from "firebase/auth";
import firebase_app from "../firebase/config";
import { hasLinkedFamily } from "../firebase/firestore/user";

const auth = getAuth(firebase_app);

export const AuthContext = createContext<{
  user: User | null;
  hasFamily: boolean | null;
  authLoading: boolean;
  isLoggingIn: boolean;
  setIsLoggingIn: Dispatch<SetStateAction<boolean>>;
  refreshFamilyStatus: () => Promise<void>;
}>({
  user: null,
  hasFamily: null,
  authLoading: true,
  isLoggingIn: false,
  setIsLoggingIn: () => {},
  refreshFamilyStatus: async () => {},
});

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [hasFamily, setHasFamily] = useState<boolean | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  const checkFamily = async (u: User) => {
    const result = await hasLinkedFamily(u.uid);
    setHasFamily(result);
  };

  const refreshFamilyStatus = useCallback(async () => {
    if (user) await checkFamily(user);
  }, [user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        await checkFamily(u);
      } else {
        setHasFamily(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        hasFamily,
        authLoading,
        isLoggingIn,
        setIsLoggingIn,
        refreshFamilyStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
